import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { randomUUID }                        from 'crypto'

// ─── POST /api/clients/[id]/payments — register a cuota payment ───────────────
// Accepts multipart/form-data (with optional comprobante image) OR JSON
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const contentType = req.headers.get('content-type') ?? ''

    let date: string
    let amount: number
    let cuotaNumber: number | undefined
    let notes: string | undefined
    let comprobanteFile: File | null = null

    // ── Parse body: multipart (with image) or JSON ────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const fd = await req.formData()
      date   = fd.get('date')   as string
      amount = parseFloat(fd.get('amount') as string)
      const cn = fd.get('cuotaNumber') as string | null
      const nt = fd.get('notes')       as string | null
      if (cn?.trim()) cuotaNumber = parseInt(cn)
      if (nt?.trim()) notes = nt.trim()
      comprobanteFile = fd.get('comprobante') as File | null
    } else {
      const body = await req.json()
      date        = body.date
      amount      = body.amount
      cuotaNumber = body.cuotaNumber !== undefined ? body.cuotaNumber : undefined
      if (body.notes?.trim()) notes = body.notes.trim()
    }

    if (!date || typeof amount !== 'number' || isNaN(amount) || amount <= 0)
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

    // ── Upload comprobante image (optional) ───────────────────────────────────
    let comprobanteUrl: string | undefined

    if (comprobanteFile && comprobanteFile.size > 0) {
      if (comprobanteFile.size > 10 * 1024 * 1024)
        return NextResponse.json(
          { error: 'La imagen no puede superar 10 MB' },
          { status: 400 }
        )

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob')
        const blob = await put(
          `jvf-comprobantes/${params.id}/${Date.now()}-comprobante`,
          comprobanteFile,
          { access: 'public' }
        )
        comprobanteUrl = blob.url
      } else {
        // Fallback: base64 data URL for small images (≤ 500 KB)
        if (comprobanteFile.size > 500 * 1024)
          return NextResponse.json(
            { error: 'Configurá BLOB_READ_WRITE_TOKEN para imágenes > 500 KB' },
            { status: 400 }
          )
        const buf = await comprobanteFile.arrayBuffer()
        comprobanteUrl = `data:${comprobanteFile.type};base64,${Buffer.from(buf).toString('base64')}`
      }
    }

    // ── Build payment object ──────────────────────────────────────────────────
    const payment: Record<string, any> = {
      id:           randomUUID(),
      date,
      amount,
      registeredAt: new Date().toISOString(),
    }
    if (cuotaNumber !== undefined) payment.cuotaNumber   = cuotaNumber
    if (notes)                     payment.notes         = notes
    if (comprobanteUrl)            payment.comprobanteUrl = comprobanteUrl

    // ── Save to MongoDB ───────────────────────────────────────────────────────
    const db     = await getDb()
    const result = await db.collection('clients').updateOne(
      { _id: params.id as any, organizationId: session.user.organizationId },
      { $push: { payments: payment } } as any
    )

    if (result.matchedCount === 0)
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    return NextResponse.json({ payment })
  } catch (err: any) {
    console.error('[POST /api/clients/[id]/payments]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── DELETE /api/clients/[id]/payments — remove a payment by id ───────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const { paymentId } = await req.json()
    if (!paymentId) return NextResponse.json({ error: 'paymentId requerido' }, { status: 400 })

    const db     = await getDb()
    const result = await db.collection('clients').updateOne(
      { _id: params.id as any, organizationId: session.user.organizationId },
      { $pull: { payments: { id: paymentId } } } as any
    )

    if (result.matchedCount === 0)
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE /api/clients/[id]/payments]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
