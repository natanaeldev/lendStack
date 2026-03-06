import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { randomUUID }                        from 'crypto'

// ─── POST /api/clients/[id]/payments — register a cuota payment ───────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body = await req.json()
    const { date, amount, cuotaNumber, notes } = body

    if (!date || typeof amount !== 'number' || amount <= 0)
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

    const payment: Record<string, any> = {
      id:           randomUUID(),
      date,
      amount,
      registeredAt: new Date().toISOString(),
    }
    if (cuotaNumber !== undefined && cuotaNumber !== null) payment.cuotaNumber = cuotaNumber
    if (notes?.trim()) payment.notes = notes.trim()

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
