import { NextResponse }                       from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'

type FxRates = Record<string, number>

const FX_FALLBACK_PER_USD: FxRates = {
  USD: 1,
  DOP: 59,
  EUR: 0.92,
  ARS: 1100,
}

async function getLiveRatesPerUsd(): Promise<FxRates> {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=DOP,EUR,ARS', { cache: 'no-store' })
    if (!res.ok) return FX_FALLBACK_PER_USD
    const data = await res.json()
    const rates = data?.rates ?? {}
    return {
      USD: 1,
      DOP: Number(rates.DOP) || FX_FALLBACK_PER_USD.DOP,
      EUR: Number(rates.EUR) || FX_FALLBACK_PER_USD.EUR,
      ARS: Number(rates.ARS) || FX_FALLBACK_PER_USD.ARS,
    }
  } catch {
    return FX_FALLBACK_PER_USD
  }
}

function toUsd(amount: number, currency: string | undefined, ratesPerUsd: FxRates): number {
  const cur = (currency ?? 'USD').toUpperCase()
  if (cur === 'USD') return amount
  const perUsd = ratesPerUsd[cur]
  if (!perUsd || perUsd <= 0) return amount
  return amount / perUsd
}

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
    const ratesPerUsd = await getLiveRatesPerUsd()

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

    const totalBranchClients = byBranch.sede + byBranch.rutas
    const byBranchPerformance = {
      sede: {
        count: byBranch.sede,
        percentage: totalBranchClients > 0 ? Math.round((byBranch.sede / totalBranchClients) * 100) : 0,
      },
      rutas: {
        count: byBranch.rutas,
        percentage: totalBranchClients > 0 ? Math.round((byBranch.rutas / totalBranchClients) * 100) : 0,
      },
      topBranch: byBranch.sede === byBranch.rutas
        ? 'tie'
        : byBranch.sede > byBranch.rutas
          ? 'sede'
          : 'rutas',
    }

    const legacyForUsd = await col.find(
      { organizationId: orgId },
      { projection: { loan: 1, loanStatus: 1 } },
    ).toArray()

    let totalAmountUsd = 0
    let totalInterestUsd = 0
    let totalMonthlyPaymentsUsd = 0
    let totalMonthlyIncomeUsd = 0
    for (const row of legacyForUsd) {
      totalAmountUsd += toUsd(row.loan?.amount ?? 0, row.loan?.currency, ratesPerUsd)
      totalInterestUsd += toUsd(row.loan?.totalInterest ?? 0, row.loan?.currency, ratesPerUsd)
      totalMonthlyPaymentsUsd += toUsd(row.loan?.monthlyPayment ?? 0, row.loan?.currency, ratesPerUsd)
      if (row.loanStatus === 'approved') {
        totalMonthlyIncomeUsd += toUsd(row.loan?.monthlyPayment ?? 0, row.loan?.currency, ratesPerUsd)
      }
    }

    const totalLoansCountLegacy = legacyForUsd.length || 1
    const avgAmountUsd = totalAmountUsd / totalLoansCountLegacy
    const avgMonthlyPaymentUsd = totalMonthlyPaymentsUsd / totalLoansCountLegacy

    // ── Date helpers ───────────────────────────────────────────────────────
    const now           = new Date()
    const todayStr      = now.toISOString().slice(0, 10)
    const daysToMon     = now.getDay() === 0 ? 6 : now.getDay() - 1
    const weekStart     = new Date(now)
    weekStart.setDate(now.getDate() - daysToMon)
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(weekStart.getDate() - 7)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const weekStartStr      = weekStart.toISOString().slice(0, 10)
    const prevWeekStartStr  = prevWeekStart.toISOString().slice(0, 10)
    const monthStartStr     = monthStart.toISOString().slice(0, 10)
    const prevMonthStartStr = prevMonthStart.toISOString().slice(0, 10)

    // ── Legacy payment collection stats ────────────────────────────────────
    const [legacyPayStats] = await col.aggregate([
      { $match: { organizationId: orgId } },
      { $unwind: { path: '$payments', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: null,
          collectedToday: { $sum: { $cond: [{ $eq:  ['$payments.date', todayStr] }, '$payments.amount', 0] } },
          collectedWeek:  { $sum: { $cond: [{ $gte: ['$payments.date', weekStartStr] }, '$payments.amount', 0] } },
          collectedWeekPrev: {
            $sum: {
              $cond: [{
                $and: [
                  { $gte: ['$payments.date', prevWeekStartStr] },
                  { $lt:  ['$payments.date', weekStartStr] },
                ],
              }, '$payments.amount', 0],
            },
          },
          collectedMonth: { $sum: { $cond: [{ $gte: ['$payments.date', monthStartStr] }, '$payments.amount', 0] } },
          collectedMonthPrev: {
            $sum: {
              $cond: [{
                $and: [
                  { $gte: ['$payments.date', prevMonthStartStr] },
                  { $lt:  ['$payments.date', monthStartStr] },
                ],
              }, '$payments.amount', 0],
            },
          },
        },
      },
    ]).toArray()

    // ── New payments collection stats ──────────────────────────────────────
    const [newPayStats] = await db.collection('payments').aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id: null,
          collectedToday: { $sum: { $cond: [{ $eq: ['$date', todayStr] }, '$amount', 0] } },
          collectedWeek:  { $sum: { $cond: [{ $gte: ['$date', weekStartStr] }, '$amount', 0] } },
          collectedWeekPrev: {
            $sum: {
              $cond: [{
                $and: [
                  { $gte: ['$date', prevWeekStartStr] },
                  { $lt:  ['$date', weekStartStr] },
                ],
              }, '$amount', 0],
            },
          },
          collectedMonth: { $sum: { $cond: [{ $gte: ['$date', monthStartStr] }, '$amount', 0] } },
          collectedMonthPrev: {
            $sum: {
              $cond: [{
                $and: [
                  { $gte: ['$date', prevMonthStartStr] },
                  { $lt:  ['$date', monthStartStr] },
                ],
              }, '$amount', 0],
            },
          },
        },
      },
    ]).toArray()

    // ── Collection rate (approved loans with ≥1 payment this month / total approved) ─
    const [collRateStats] = await col.aggregate([
      { $match: { organizationId: orgId, loanStatus: 'approved' } },
      {
        $project: {
          paidThisMonth: {
            $gt: [{
              $size: {
                $filter: {
                  input: { $ifNull: ['$payments', []] },
                  as: 'p',
                  cond: { $gte: ['$$p.date', monthStartStr] },
                },
              },
            }, 0],
          },
        },
      },
      {
        $group: {
          _id:           null,
          totalApproved: { $sum: 1 },
          paidThisMonth: { $sum: { $cond: ['$paidThisMonth', 1, 0] } },
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

    // ── Collection rate ────────────────────────────────────────────────────
    const collectionRate   = (collRateStats?.totalApproved ?? 0) > 0
      ? Math.round(((collRateStats.paidThisMonth ?? 0) / collRateStats.totalApproved) * 100)
      : 0
    const paidPeriodsCount = collRateStats?.paidThisMonth ?? 0

    // ── Overdue amount per currency (JS computation on approved loans) ──────
    const approvedLoans = await col.find(
      { organizationId: orgId, loanStatus: 'approved' },
      { projection: { 'loan.monthlyPayment': 1, 'loan.totalMonths': 1, 'loan.currency': 1, savedAt: 1, payments: 1 } },
    ).toArray()

    const overdueMap: Record<string, number> = {}
    for (const loan of approvedLoans) {
      const savedAt       = new Date(loan.savedAt ?? Date.now())
      const monthsElapsed = Math.max(0,
        (now.getFullYear() - savedAt.getFullYear()) * 12 +
        (now.getMonth()    - savedAt.getMonth()),
      )
      const duePeriods   = Math.min(monthsElapsed, loan.loan?.totalMonths ?? 0)
      const expectedPaid = (loan.loan?.monthlyPayment ?? 0) * duePeriods
      const actualPaid   = ((loan.payments ?? []) as { amount: number }[])
        .reduce((s, p) => s + (p.amount ?? 0), 0)
      const deficit = Math.max(0, expectedPaid - actualPaid)
      if (deficit > 0) {
        const cur = loan.loan?.currency ?? 'USD'
        overdueMap[cur] = (overdueMap[cur] ?? 0) + deficit
      }
    }
    const overdueAmountByCurrency = Object.entries(overdueMap).map(([currency, amount]) => ({
      currency,
      amount: Math.round(amount),
    }))

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
    const collectedWeek = Math.max(legacyPayStats?.collectedWeek ?? 0, newPayStats?.collectedWeek ?? 0)
    const collectedWeekPrev = Math.max(legacyPayStats?.collectedWeekPrev ?? 0, newPayStats?.collectedWeekPrev ?? 0)
    const collectedMonth = Math.max(legacyPayStats?.collectedMonth ?? 0, newPayStats?.collectedMonth ?? 0)
    const collectedMonthPrev = Math.max(legacyPayStats?.collectedMonthPrev ?? 0, newPayStats?.collectedMonthPrev ?? 0)

    const loansForUsd = await loansCol.find(
      { organizationId: orgId },
      {
        projection: {
          status: 1,
          amount: 1,
          currency: 1,
          disbursedAmount: 1,
          remainingBalance: 1,
          overdueAmount: 1,
        },
      },
    ).toArray()

    let totalDisbursedUsd = 0
    let activePortfolioUsd = 0
    let overdueAmountTotalUsd = 0
    let totalPrincipalOriginatedUsd = 0
    for (const loan of loansForUsd) {
      const cur = loan.currency ?? 'USD'
      const status = loan.status ?? ''

      if (!['cancelled', 'denied', 'draft'].includes(status)) {
        totalPrincipalOriginatedUsd += toUsd(loan.amount ?? 0, cur, ratesPerUsd)
      }
      if (['active', 'delinquent', 'paid_off', 'disbursed'].includes(status)) {
        totalDisbursedUsd += toUsd(loan.disbursedAmount ?? loan.amount ?? 0, cur, ratesPerUsd)
      }
      if (['active', 'delinquent'].includes(status)) {
        activePortfolioUsd += toUsd(loan.remainingBalance ?? 0, cur, ratesPerUsd)
      }
      if (status === 'delinquent') {
        overdueAmountTotalUsd += toUsd(loan.overdueAmount ?? 0, cur, ratesPerUsd)
      }
    }

    return NextResponse.json({
      configured:           true,
      // Legacy stats (unchanged for backward compat with existing Dashboard)
      totalClients:         totals?.totalClients          ?? 0,
      totalLoans:           totals?.totalLoans            ?? 0,
      totalAmount:          totalAmountUsd,
      avgMonthlyPayment:    avgMonthlyPaymentUsd,
      avgAmount:            avgAmountUsd,
      totalInterest:        totalInterestUsd,
      avgTermMonths:        totals?.avgTermMonths         ?? 0,
      totalMonthlyPayments: totalMonthlyPaymentsUsd,
      totalMonthlyIncome:   totalMonthlyIncomeUsd,
      approvedCapital:      toUsd(approvedStats?.totalCapital ?? 0, 'USD', ratesPerUsd),
      byProfile,
      byCurrency,
      byBranch,
      byBranchPerformance,
      avgPaymentByCurrency,
      recoveryByCurrency,
      recentClients,
      pendingCount,
      approvedCount,
      deniedCount,
      collectedToday,
      collectedWeek,
      collectedWeekPrev,
      collectedMonth,
      collectedMonthPrev,
      collectionRate,
      paidPeriodsCount,
      overdueAmountByCurrency,
      // New operational portfolio stats
      portfolio: {
        totalLoansCount:      portfolio?.totalLoansCount      ?? 0,
        totalDisbursed:       totalDisbursedUsd,
        activePortfolio:      activePortfolioUsd,
        totalActiveCount:     portfolio?.totalActiveCount     ?? 0,
        delinquentCount:      portfolio?.delinquentCount      ?? 0,
        overdueAmountTotal:   overdueAmountTotalUsd,
        totalPrincipalOriginated: totalPrincipalOriginatedUsd,
        paidOffCount:         portfolio?.paidOffCount         ?? 0,
        pendingApprovalCount: portfolio?.pendingApprovalCount ?? 0,
        approvalRate,
        dueTodayCount:        dueToday?.count ?? 0,
        dueTodayAmount:       dueToday?.total ?? 0,
        collectedMonth,
        byLifecycle,
      },
      baseCurrency: 'USD',
      exchangeRatesPerUsd: ratesPerUsd,
    })
  } catch (err: any) {
    console.error('[GET /api/stats]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
