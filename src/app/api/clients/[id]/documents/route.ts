import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { v4 as uuidv4 }                     from 'uuid'

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

    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json({ error: 'Max file size is 10 MB' }, { status: 400 })

    const db  = await getDb()
    const col = db.collection('clients')

    // Verify the client belongs to this org before uploading
    const client = await col.findOne({
      _id:            params.id as any,
      organizationId: session.user.organizationId,
    })
    if (!client)
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    // ── Upload: Vercel Blob (preferred) or base64 fallback ──────────────────
    let fileUrl: string

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob')
      const blob = await put(`jvf-clients/${params.id}/${Date.now()}-${file.name}`, file, {
        access: 'private',
      })
      fileUrl = blob.url
    } else {
      // Fallback: store tiny files as base64 data URL (≤ 500 KB)
      if (file.size > 500 * 1024)
        return NextResponse.json(
          { error: 'Add BLOB_READ_WRITE_TOKEN to enable files > 500 KB' },
          { status: 400 }
        )
      const buf = await file.arrayBuffer()
      fileUrl = `data:${file.type};base64,${Buffer.from(buf).toString('base64')}`
    }

    const docId      = uuidv4()
    const uploadedAt = new Date().toISOString()

    await col.updateOne(
      { _id: params.id as any },
      {
        $push: {
          documents: {
            id: docId,
            name: file.name,
            url: fileUrl,
            type: file.type,
            size: file.size,
            uploadedAt,
          },
        } as any,
      }
    )

    return NextResponse.json({
      success: true,
      document: { id: docId, name: file.name, url: fileUrl,
                  type: file.type, size: file.size, uploadedAt },
    })
  } catch (err: any) {
    console.error('[POST /api/clients/[id]/documents]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
