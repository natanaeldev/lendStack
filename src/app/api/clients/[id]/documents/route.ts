import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { v4 as uuidv4 }                     from 'uuid'
import { uploadDocument, isS3Configured }   from '@/lib/s3'

// Allowed MIME types — explicit allowlist, not a denylist
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
])

const MAX_FILE_SIZE   = 10 * 1024 * 1024  // 10 MB
const MAX_BASE64_SIZE = 500 * 1024         // 500 KB (local dev fallback)

// ─── POST /api/clients/[id]/documents ────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file)
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // ── Validate file type ────────────────────────────────────────────────────
    if (!ALLOWED_TYPES.has(file.type))
      return NextResponse.json(
        { error: `Tipo de archivo no permitido. Formatos aceptados: PDF, Word, Excel, imágenes, texto.` },
        { status: 400 }
      )

    // ── Validate file size ────────────────────────────────────────────────────
    if (file.size > MAX_FILE_SIZE)
      return NextResponse.json(
        { error: 'El archivo excede el límite de 10 MB' },
        { status: 400 }
      )

    if (file.size === 0)
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })

    const db  = await getDb()
    const col = db.collection('clients')
    const orgId = session.user.organizationId

    // Verify the client belongs to this org before accepting the upload
    const client = await col.findOne({
      _id:            params.id as any,
      organizationId: orgId,
    })
    if (!client)
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    // ── Storage: S3 (production) or base64 fallback (local dev) ──────────────
    let fileUrl: string
    let storageType: 'S3' | 'base64'

    if (isS3Configured()) {
      // Production path: upload to S3 with SSE-KMS, get the object key back
      const result = await uploadDocument(orgId, params.id, file)
      // Store the S3 key (not the URL) — URLs are generated on demand via presigned URLs
      fileUrl     = `s3://${result.bucket}/${result.key}`
      storageType = 'S3'
    } else {
      // Local dev fallback: base64 data URL
      if (file.size > MAX_BASE64_SIZE)
        return NextResponse.json(
          { error: 'En entorno local, máximo 500 KB. Configure AWS_S3_DOCUMENTS_BUCKET para archivos mayores.' },
          { status: 400 }
        )
      const buf = await file.arrayBuffer()
      fileUrl     = `data:${file.type};base64,${Buffer.from(buf).toString('base64')}`
      storageType = 'base64'
    }

    const docId      = uuidv4()
    const uploadedAt = new Date().toISOString()

    await col.updateOne(
      { _id: params.id as any },
      {
        $push: {
          documents: {
            id:          docId,
            name:        file.name,
            url:         fileUrl,
            type:        file.type,
            size:        file.size,
            uploadedAt,
            storageType,
          },
        } as any,
      }
    )

    return NextResponse.json({
      success: true,
      document: {
        id:          docId,
        name:        file.name,
        url:         fileUrl,
        type:        file.type,
        size:        file.size,
        uploadedAt,
        storageType,
      },
    })
  } catch (err: any) {
    console.error('[POST /api/clients/[id]/documents]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
