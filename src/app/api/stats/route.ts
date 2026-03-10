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
    const db      = await getDb()
    const col     = db.collection('clients')
    const loansCol = db.collection('loans')
    const orgId   = session.user.organizationId

    // ── Aggregate totals from legacy clients collection ────────────────────
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

    // ── Date helpers ───────────────────────────────────────────────────────
    const now          = new Date()
    const todayStr     = now.toISOString().slice(0, 10)
    const daysToMon    = now.getDay() === 0 ? 6 : now.getDay() - 1
    const weekStart    = new Date(now)
    weekStart.setDate(now.getDate() - daysToMon)
    const weekStartStr  = weekStart.toISOString().slice(0, 10)
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    // ── Legacy payment collection stats ────────────────────────────────────
    const [legacyPayStats] = await col.aggregate([
      { $match: { organizationId: orgId } },
      { $unwind: { path: '$payments', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: null,
          collectedToday: { $sum: { $cond: [{ $eq:  ['$payments.date', todayStr]    }, '$payments.amount', 0] } },
          collectedWeek:  { $sum: { $cond: [{ $gte: ['$payments.date', weekStartStr] }, '$payments.amount', 0] } },
          collectedMonth: { $sum: { $cond: [{ $gte: ['$payments.date', monthStartStr]}, '$payments.amount', 0] } },
        },
      },
    ]).toArray()

    // ── New payments collection stats ──────────────────────────────────────
    const [newPayStats] = await db.collection('payments').aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id: null,
          collectedToday: { $sum: { $cond: [{ $eq:  ['$date', todayStr]    }, '$amount', 0] } },
          collectedMonth: { $sum: { $cond: [{ $gte: ['$date', monthStartStr]}, '$amount', 0] } },
        },
      },
    ]).toArray()

    // ── Operational portfolio from loans collection ────────────────────────
    const [portfolio] = await loansCol.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id:                 null,
          totalLoansCount:     { $sum: 1 },
          totalDisbursed:      { $sum: { $cond: [{ $in: ['$status', ['active','delinquent','paid_off','disbursed']] }, { $ifNull: ['$disbursedAmount', '$amount'] }, 0] } },
          activePortfolio:     { $sum: { $cond: [{ $in: ['$status', ['active','delinquent']] }, '$remainingBalance', 0] } },
          totalActiveCount:    { $sum: { $cond: [{ $in: ['$status', ['active','delinquent']] }, 1, 0] } },
          delinquentCount:     { $sum: { $cond: [{ $eq:  ['$status', 'delinquent'] }, 1, 0] } },
          overdueAmountTotal:  { $sum: { $cond: [{ $eq:  ['$status', 'delinquent'] }, { $ifNull: ['$overdueAmount', 0] }, 0] } },
          paidOffCount:        { $sum: { $cond: [{ $eq:  ['$status', 'paid_off']   }, 1, 0] } },
          pendingApprovalCount:{ $sum: { $cond: [{ $in: ['$status', ['application_submitted','under_review']] }, 1, 0] } },
        },
      },
    ]).toArray()

    // ── Lifecycle distribution ─────────────────────────────────────────────
    const byLifecycle = await loansCol.aggregate([
      { $match: { organizationId: orgId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]).toArray()

    // ── Approval rate ──────────────────────────────────────────────────────
    const totalDecided  = await loansCol.countDocuments({ organizationId: orgId, status: { $in: ['approved','denied','active','delinquent','paid_off','disbursed','defaulted'] } })
    const totalApproved = await loansCol.countDocuments({ organizationId: orgId, status: { $in: ['approved','disbursed','active','delinquent','paid_off'] } })
    const approvalRate  = totalDecided > 0 ? totalApproved / totalDecided : 0

    // ── Installments due today ─────────────────────────────────────────────
    const [dueToday] = await db.collection('installments').aggregate([
      { $match: { organizationId: orgId, dueDate: todayStr, remainingAmount: { $gt: 0 } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$remainingAmount' } } },
    ]).toArray()

    // ── 5 most-recent clients ──────────────────────────────────────────────
    const recentRaw = await col
      .find({ organizationId: orgId }, {
        projection: {
          _id: 1, name: 1, email: 1, savedAt: 1,
          'loan.amount': 1, 'loan.profile': 1, 'loan.currency': 1, 'loan.monthlyPayment': 1,
        },
      })
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

    const collectedToday = Math.max(legacyPayStats?.collectedToday ?? 0, newPayStats?.collectedToday ?? 0)
    const collectedMonth = Math.max(legacyPayStats?.collectedMonth ?? 0, newPayStats?.collectedMonth ?? 0)

    return NextResponse.json({
      configured:           true,
      // Legacy stats (unchanged for backward compat with existing Dashboard)
      totalClients:         totals?.totalClients          ?? 0,
      totalLoans:           totals?.totalLoans            ?? 0,
      totalAmount:          totals?.totalAmount           ?? 0,
      avgMonthlyPayment:    totals?.avgMonthlyPayment     ?? 0,
      avgAmount:            totals?.avgAmount             ?? 0,
      totalInterest:        totals?.totalInterest         ?? 0,
      avgTermMonths:        totals?.avgTermMonths         ?? 0,
      totalMonthlyPayments: totals?.totalMonthlyPayments  ?? 0,
      totalMonthlyIncome:   approvedStats?.totalMonthlyIncome ?? 0,
      approvedCapital:      approvedStats?.totalCapital       ?? 0,
      byProfile,
      byCurrency,
      byBranch,
      avgPaymentByCurrency,
      recentClients,
      pendingCount,
      approvedCount,
      deniedCount,
      collectedToday,
      collectedWeek:        legacyPayStats?.collectedWeek ?? 0,
      collectedMonth,
      // New operational portfolio stats
      portfolio: {
        totalLoansCount:      portfolio?.totalLoansCount      ?? 0,
        totalDisbursed:       portfolio?.totalDisbursed       ?? 0,
        activePortfolio:      portfolio?.activePortfolio      ?? 0,
        totalActiveCount:     portfolio?.totalActiveCount     ?? 0,
        delinquentCount:      portfolio?.delinquentCount      ?? 0,
        overdueAmountTotal:   portfolio?.overdueAmountTotal   ?? 0,
        paidOffCount:         portfolio?.paidOffCount         ?? 0,
        pendingApprovalCount: portfolio?.pendingApprovalCount ?? 0,
        approvalRate,
        dueTodayCount:        dueToday?.count ?? 0,
        dueTodayAmount:       dueToday?.total ?? 0,
        collectedMonth,
        byLifecycle,
      },
    })
  } catch (err: any) {
    console.error('[GET /api/stats]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
