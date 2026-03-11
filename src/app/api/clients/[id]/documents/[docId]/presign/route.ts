import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { getPresignedDownloadUrl }           from '@/lib/s3'
import { getDownloadUrl }                    from '@vercel/blob'

/**
 * GET /api/clients/[id]/documents/[docId]/presign
 *
 * Redirects to a short-lived signed download URL for a specific document.
 *
 * Security model:
 *   1. Caller must be authenticated (valid session).
 *   2. Client must belong to caller's organization (org-scoped query).
 *   3. Document must exist in the client's document list (not guessable).
 *   4. S3 URL is generated server-side — the client never has AWS credentials.
 *   5. URL expires in 15 minutes — even if leaked, it's short-lived.
 *
 * For base64-stored documents (local dev), redirects to the data URL directly.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db  = await getDb()
    const col = db.collection('clients')

    // Fetch just the documents array — minimal projection for performance
    const client = await col.findOne(
      { _id: params.id as any, organizationId: session.user.organizationId },
      { projection: { documents: 1 } }
    )

    if (!client)
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const doc = (client.documents ?? []).find((d: any) => d.id === params.docId)
    if (!doc)
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

    // Base64 documents (local dev): redirect directly
    if (doc.url?.startsWith('data:') || doc.storageType === 'base64') {
      return NextResponse.redirect(doc.url)
    }

    // Legacy Vercel Blob documents
    if (doc.url?.startsWith('https://') && doc.url.includes('blob.vercel-storage.com')) {
      const downloadUrl = await getDownloadUrl(doc.url)
      return NextResponse.redirect(downloadUrl)
    }

    // S3 documents: extract key from stored s3:// URI and generate presigned URL
    if (!doc.url?.startsWith('s3://'))
      return NextResponse.json({ error: 'Formato de documento desconocido' }, { status: 400 })

    // s3://bucket-name/org/orgId/clients/clientId/docs/timestamp-filename
    const s3Path  = doc.url.slice('s3://'.length)  // "bucket/key"
    const slashIdx = s3Path.indexOf('/')
    const key     = s3Path.slice(slashIdx + 1)      // everything after first slash

    const presignedUrl = await getPresignedDownloadUrl(key, 900)  // 15 min

    return NextResponse.redirect(presignedUrl)
  } catch (err: any) {
    console.error('[GET presign]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
