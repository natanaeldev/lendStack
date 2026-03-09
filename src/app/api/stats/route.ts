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
          avgTermMonths:    { $avg: '$loan.totalMonths' },
          totalMonthlyPayments: { $sum: '$loan.monthlyPayment' },
        },
      },
    ]).toArray()

    // ── Approved-loan income ───────────────────────────────────────────────
    const [approvedStats] = await col.aggregate([
      { $match: { organizationId: orgId, loanStatus: 'approved' } },
      {
        $group: {
          _id:                null,
          totalMonthlyIncome: { $sum: '$loan.monthlyPayment' },
          totalCapital:       { $sum: '$loan.amount' },
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

    // ── Capital recovery per currency ─────────────────────────────────────
    // totalRecovered = sum of all payments made, grouped by loan currency
    const recoveryRaw = await col.aggregate([
      { $match: { organizationId: orgId } },
      {
        $project: {
          currency:      '$loan.currency',
          loanAmount:    '$loan.amount',
          totalPaid:     { $sum: '$payments.amount' },
        },
      },
      {
        $group: {
          _id:            '$currency',
          totalAmount:    { $sum: '$loanAmount' },
          totalRecovered: { $sum: '$totalPaid' },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, currency: '$_id', totalAmount: 1, totalRecovered: 1 } },
    ]).toArray()

    const recoveryByCurrency = recoveryRaw.map(r => ({
      currency:       r.currency as string,
      totalAmount:    r.totalAmount   as number,
      totalRecovered: r.totalRecovered as number,
      percentage:     r.totalAmount > 0
        ? Math.round((r.totalRecovered / r.totalAmount) * 100)
        : 0,
    }))

    // ── Avg monthly payment per currency ──────────────────────────────────
    const avgPaymentByCurrency = await col.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id:               '$loan.currency',
          avgMonthlyPayment: { $avg: '$loan.monthlyPayment' },
          count:             { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, currency: '$_id', avgMonthlyPayment: 1, count: 1 } },
    ]).toArray()

    // ── By branch ─────────────────────────────────────────────────────────
    const byBranchRaw = await col.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id:   { $ifNull: ['$branch', 'sin_sucursal'] },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, branch: '$_id', count: 1 } },
    ]).toArray()

    const byBranch = {
      sede:  byBranchRaw.find(b => b.branch === 'sede')?.count  ?? 0,
      rutas: byBranchRaw.find(b => b.branch === 'rutas')?.count ?? 0,
    }

    // ── Payment collection stats (today / week / month) ────────────────────
    const now          = new Date()
    const todayStr     = now.toISOString().slice(0, 10)
    const daysToMon    = now.getDay() === 0 ? 6 : now.getDay() - 1
    const weekStart    = new Date(now)
    weekStart.setDate(now.getDate() - daysToMon)
    const weekStartStr  = weekStart.toISOString().slice(0, 10)
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const [paymentStats] = await col.aggregate([
      { $match: { organizationId: orgId } },
      { $unwind: { path: '$payments', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: null,
          collectedToday: {
            $sum: { $cond: [{ $eq: ['$payments.date', todayStr] }, '$payments.amount', 0] },
          },
          collectedWeek: {
            $sum: { $cond: [{ $gte: ['$payments.date', weekStartStr] }, '$payments.amount', 0] },
          },
          collectedMonth: {
            $sum: { $cond: [{ $gte: ['$payments.date', monthStartStr] }, '$payments.amount', 0] },
          },
        },
      },
    ]).toArray()

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
      configured:          true,
      totalClients:        totals?.totalClients         ?? 0,
      totalLoans:          totals?.totalLoans           ?? 0,
      totalAmount:         totals?.totalAmount          ?? 0,
      avgMonthlyPayment:   totals?.avgMonthlyPayment    ?? 0,
      avgAmount:           totals?.avgAmount            ?? 0,
      totalInterest:       totals?.totalInterest        ?? 0,
      avgTermMonths:       totals?.avgTermMonths        ?? 0,
      totalMonthlyPayments:totals?.totalMonthlyPayments ?? 0,
      totalMonthlyIncome:  approvedStats?.totalMonthlyIncome ?? 0,
      approvedCapital:     approvedStats?.totalCapital       ?? 0,
      byProfile,
      byCurrency,
      byBranch,
      avgPaymentByCurrency,
      recoveryByCurrency,
      recentClients,
      pendingCount,
      approvedCount,
      deniedCount,
      collectedToday: paymentStats?.collectedToday ?? 0,
      collectedWeek:  paymentStats?.collectedWeek  ?? 0,
      collectedMonth: paymentStats?.collectedMonth ?? 0,
    })
  } catch (err: any) {
    console.error('[GET /api/stats]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
