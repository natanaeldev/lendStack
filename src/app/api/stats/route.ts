import { NextResponse }                       from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'

// ─── GET /api/stats ───────────────────────────────────────────────────────────
export async function GET() {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db    = await getDb()
    const col   = db.collection('clients')
    const orgId = session.user.organizationId

    // ── Aggregate totals ───────────────────────────────────────────────────
    const [totals] = await col.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id:              null,
          totalClients:     { $sum: 1 },
          totalLoans:       { $sum: 1 },
          totalAmount:      { $sum: '$loan.amount' },
          avgMonthlyPayment:{ $avg: '$loan.monthlyPayment' },
          avgAmount:        { $avg: '$loan.amount' },
          totalInterest:    { $sum: '$loan.totalInterest' },
        },
      },
    ]).toArray()

    // ── By risk profile ────────────────────────────────────────────────────
    const byProfile = await col.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id:         '$loan.profile',
          count:       { $sum: 1 },
          totalAmount: { $sum: '$loan.amount' },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $project: { _id: 0, profile: '$_id', count: 1, totalAmount: 1 } },
    ]).toArray()

    // ── By currency ────────────────────────────────────────────────────────
    const byCurrency = await col.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id:         '$loan.currency',
          count:       { $sum: 1 },
          totalAmount: { $sum: '$loan.amount' },
        },
      },
      { $project: { _id: 0, currency: '$_id', count: 1, totalAmount: 1 } },
    ]).toArray()

    // ── By loan status ─────────────────────────────────────────────────────
    const byStatus = await col.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id:   { $ifNull: ['$loanStatus', 'pending'] },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]).toArray()

    const pendingCount  = byStatus.find(s => s.status === 'pending')?.count  ?? 0
    const approvedCount = byStatus.find(s => s.status === 'approved')?.count ?? 0
    const deniedCount   = byStatus.find(s => s.status === 'denied')?.count   ?? 0

    // ── 5 most-recent clients ──────────────────────────────────────────────
    const recentRaw = await col
      .find(
        { organizationId: orgId },
        {
          projection: {
            _id: 1, name: 1, email: 1, savedAt: 1,
            'loan.amount': 1, 'loan.profile': 1,
            'loan.currency': 1, 'loan.monthlyPayment': 1,
          },
        }
      )
      .sort({ savedAt: -1 })
      .limit(5)
      .toArray()

    const recentClients = recentRaw.map(c => ({
      id:             String(c._id),
      name:           c.name,
      email:          c.email,
      savedAt:        c.savedAt,
      amount:         c.loan?.amount,
      profile:        c.loan?.profile,
      currency:       c.loan?.currency,
      monthlyPayment: c.loan?.monthlyPayment,
    }))

    return NextResponse.json({
      configured:        true,
      totalClients:      totals?.totalClients      ?? 0,
      totalLoans:        totals?.totalLoans        ?? 0,
      totalAmount:       totals?.totalAmount       ?? 0,
      avgMonthlyPayment: totals?.avgMonthlyPayment ?? 0,
      avgAmount:         totals?.avgAmount         ?? 0,
      totalInterest:     totals?.totalInterest     ?? 0,
      byProfile,
      byCurrency,
      recentClients,
      pendingCount,
      approvedCount,
      deniedCount,
    })
  } catch (err: any) {
    console.error('[GET /api/stats]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
