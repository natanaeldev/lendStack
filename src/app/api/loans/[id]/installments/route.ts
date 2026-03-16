import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'

// ─── GET /api/loans/[id]/installments ────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db    = await getDb()
    const orgId = session.user.organizationId

    // Verify loan belongs to this org
    const loan = await db.collection('loans').findOne({
      _id:            params.id as any,
      organizationId: orgId,
    })
    if (!loan) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })

    const installments = await db.collection('installments')
      .find({ loanId: params.id, organizationId: orgId })
      .sort({ installmentNumber: 1 })
      .toArray()

    return NextResponse.json({
      installments: installments.map(i => ({ ...i, _id: String(i._id) })),
    })
  } catch (err: any) {
    console.error('[GET /api/loans/[id]/installments]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
