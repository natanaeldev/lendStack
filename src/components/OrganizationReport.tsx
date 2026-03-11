'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────
interface StatsData {
  totalClients: number
  totalLoans: number
  approvedCount: number
  pendingCount: number
  deniedCount: number
  totalAmount: number
  totalInterest: number
  totalMonthlyIncome: number
  collectedToday: number
  collectedWeek: number
  collectedWeekPrev: number
  collectedMonth: number
  collectedMonthPrev: number
  collectionRate: number
  paidPeriodsCount: number
  overdueAmountByCurrency: { currency: string; amount: number }[]
  byBranch: { sede: number; rutas: number }
  byBranchPerformance: {
    sede: { count: number; percentage: number }
    rutas: { count: number; percentage: number }
    topBranch: 'sede' | 'rutas' | 'tie'
  }
  byProfile: { profile: string; count: number; totalAmount: number }[]
  byCurrency: { currency: string; count: number; totalAmount: number }[]
  recoveryByCurrency: { currency: string; totalAmount: number; totalRecovered: number; percentage: number }[]
  recentClients: {
    id: string; name: string; email: string; savedAt: string
    amount: number; profile: string; currency: string; monthlyPayment: number
  }[]
  portfolio: {
    totalLoansCount: number
    totalDisbursed: number
    activePortfolio: number
    totalActiveCount: number
    delinquentCount: number
    overdueAmountTotal: number
    totalPrincipalOriginated: number
    paidOffCount: number
    pendingApprovalCount: number
    approvalRate: number
    dueTodayCount: number
    dueTodayAmount: number
    collectedMonth: number
    byLifecycle: { status: string; count: number }[]
  }
  baseCurrency: string
  exchangeRatesPerUsd: Record<string, number>
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toFixed(1)}%`
const num = (n: number) => n.toLocaleString('en-US')

// ─── Design tokens (Chase-inspired) ───────────────────────────────────────────
const C = {
  navy:    '#0A1628',
  blue:    '#117ACA',
  gold:    '#B8860B',
  green:   '#1A6B3A',
  red:     '#B91C1C',
  slate:   '#64748B',
  border:  '#D1D5DB',
  bg:      '#F8FAFC',
  white:   '#FFFFFF',
}

// ─── Lifecycle label map ──────────────────────────────────────────────────────
const LIFECYCLE_LABEL: Record<string, string> = {
  draft:                 'Draft',
  application_submitted: 'Submitted',
  under_review:          'Under Review',
  approved:              'Approved',
  disbursed:             'Disbursed',
  active:                'Active',
  delinquent:            'Delinquent',
  paid_off:              'Paid Off',
  defaulted:             'Defaulted',
  cancelled:             'Cancelled',
  denied:                'Denied',
}

const LIFECYCLE_COLOR: Record<string, string> = {
  active:                '#1A6B3A',
  disbursed:             '#117ACA',
  approved:              '#0A6EBD',
  paid_off:              '#6B7280',
  delinquent:            '#D97706',
  defaulted:             '#B91C1C',
  cancelled:             '#94A3B8',
  denied:                '#F87171',
  under_review:          '#7C3AED',
  application_submitted: '#9333EA',
  draft:                 '#CBD5E1',
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function OrganizationReport() {
  const [stats, setStats]   = useState<StatsData | null>(null)
  const [orgName, setOrgName] = useState('—')
  const [plan, setPlan]     = useState('—')
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const reportDate = new Date()

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [orgRes, statsRes] = await Promise.all([
          fetch('/api/org', { cache: 'no-store' }),
          fetch('/api/stats', { cache: 'no-store' }),
        ])
        if (!orgRes.ok || !statsRes.ok) throw new Error('Unable to load report data.')
        const orgJson   = await orgRes.json()
        const statsJson = await statsRes.json()
        if (!mounted) return
        setOrgName(orgJson?.orgName ?? '—')
        setPlan((orgJson?.plan ?? 'starter').toUpperCase())
        setStats(statsJson)
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Unexpected error')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!stats) return null
    const p = stats.portfolio

    const nplRatio        = p.totalActiveCount > 0 ? (p.delinquentCount / p.totalActiveCount) * 100 : 0
    const capitalAtRisk   = p.activePortfolio > 0   ? (p.overdueAmountTotal / p.activePortfolio) * 100 : 0
    const annualYield     = p.activePortfolio > 0   ? ((stats.totalMonthlyIncome * 12) / p.activePortfolio) * 100 : 0
    const weekDelta       = stats.collectedWeekPrev > 0  ? ((stats.collectedWeek - stats.collectedWeekPrev) / stats.collectedWeekPrev) * 100 : (stats.collectedWeek > 0 ? 100 : 0)
    const monthDelta      = stats.collectedMonthPrev > 0 ? ((stats.collectedMonth - stats.collectedMonthPrev) / stats.collectedMonthPrev) * 100 : (stats.collectedMonth > 0 ? 100 : 0)
    const totalRecoveryPct = stats.recoveryByCurrency.length > 0
      ? stats.recoveryByCurrency.reduce((s, r) => s + r.totalRecovered, 0) /
        Math.max(stats.recoveryByCurrency.reduce((s, r) => s + r.totalAmount, 0), 1) * 100
      : 0

    return { nplRatio, capitalAtRisk, annualYield, weekDelta, monthDelta, totalRecoveryPct }
  }, [stats])

  const lifecycleData = useMemo(() => {
    if (!stats) return []
    return stats.portfolio.byLifecycle
      .map(l => ({ ...l, label: LIFECYCLE_LABEL[l.status] ?? l.status, color: LIFECYCLE_COLOR[l.status] ?? '#94A3B8' }))
      .sort((a, b) => b.count - a.count)
  }, [stats])

  const revenueChartData = useMemo(() => {
    if (!stats) return []
    return [
      { period: 'Prev Week', amount: stats.collectedWeekPrev },
      { period: 'This Week', amount: stats.collectedWeek },
      { period: 'Prev Month', amount: stats.collectedMonthPrev },
      { period: 'This Month', amount: stats.collectedMonth },
    ]
  }, [stats])

  // ── Render states ───────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: C.navy, borderTopColor: 'transparent' }} />
        <p className="text-sm font-medium" style={{ color: C.slate }}>Loading report data…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="font-semibold text-red-700">{error}</p>
    </div>
  )

  if (!stats || !metrics) return null

  const p = stats.portfolio

  return (
    <div className="font-sans" style={{ background: C.bg, minHeight: '100vh' }}>
      {/* ── PRINT STYLES ── */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      {/* ── COVER BANNER ────────────────────────────────────────────────────── */}
      <div style={{ background: C.navy }} className="px-6 py-8 sm:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: C.gold }}>
                CONFIDENTIAL — INTERNAL USE ONLY
              </p>
              <h1 className="text-2xl sm:text-4xl font-bold text-white leading-tight">
                Portfolio Performance Report
              </h1>
              <p className="text-lg font-semibold mt-1" style={{ color: '#93C5FD' }}>{orgName}</p>
            </div>
            <div className="text-right space-y-1">
              <div className="text-xs font-semibold px-3 py-1 rounded-full inline-block" style={{ background: C.gold, color: C.white }}>
                TIER: {plan}
              </div>
              <p className="text-xs text-blue-200 mt-2">
                As of {reportDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-xs text-blue-300">
                {reportDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · All amounts in USD
              </p>
              <button
                onClick={() => window.print()}
                className="no-print mt-2 text-xs font-semibold px-3 py-1.5 rounded border border-blue-400 text-blue-200 hover:bg-blue-900 transition-colors">
                ⎙ Print / Export PDF
              </button>
            </div>
          </div>

          {/* Top-level KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            <CoverKpi label="Total Principal Originated" value={usd.format(p.totalPrincipalOriginated)} sub="excl. cancelled/denied" />
            <CoverKpi label="Active Portfolio" value={usd.format(p.activePortfolio)} sub={`${num(p.totalActiveCount)} live loans`} />
            <CoverKpi label="Monthly Revenue" value={usd.format(stats.totalMonthlyIncome)} sub="approved loan payments" />
            <CoverKpi label="Collection Rate" value={pct(stats.collectionRate)} sub={`${num(stats.paidPeriodsCount)} paid this month`} />
          </div>
        </div>
      </div>

      {/* ── SECTION DIVIDER ─────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ═══ SECTION I — EXECUTIVE SUMMARY ═══════════════════════════════════ */}
        <Section label="SECTION I" title="Executive Summary & Key Risk Indicators">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <RatioCard label="Approval Rate"    value={pct(p.approvalRate * 100)}  status="neutral" />
            <RatioCard label="NPL Ratio"        value={pct(metrics.nplRatio)}       status={metrics.nplRatio > 10 ? 'bad' : metrics.nplRatio > 5 ? 'warn' : 'good'} />
            <RatioCard label="Capital at Risk"  value={pct(metrics.capitalAtRisk)}  status={metrics.capitalAtRisk > 15 ? 'bad' : metrics.capitalAtRisk > 7 ? 'warn' : 'good'} />
            <RatioCard label="Portfolio Yield"  value={pct(metrics.annualYield)}    status="neutral" sub="annualized" />
            <RatioCard label="Capital Recovery" value={pct(metrics.totalRecoveryPct)} status={metrics.totalRecoveryPct > 60 ? 'good' : 'warn'} />
            <RatioCard label="Delinquent"       value={num(p.delinquentCount)}      status={p.delinquentCount === 0 ? 'good' : p.delinquentCount < 5 ? 'warn' : 'bad'} sub="loans" />
          </div>

          <div className="mt-4 rounded-lg border-l-4 p-4" style={{ borderColor: C.gold, background: '#FFFBEB' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: C.gold }}>Analyst Commentary</p>
            <p className="text-sm" style={{ color: C.navy }}>
              Portfolio NPL stands at <strong>{pct(metrics.nplRatio)}</strong> with{' '}
              <strong>{usd.format(p.overdueAmountTotal)}</strong> in delinquent exposure.
              {' '}Active book of <strong>{usd.format(p.activePortfolio)}</strong> is generating an
              annualized yield of <strong>{pct(metrics.annualYield)}</strong>.
              {' '}Collection efficiency of <strong>{pct(stats.collectionRate)}</strong> indicates
              {stats.collectionRate >= 80 ? ' strong' : stats.collectionRate >= 60 ? ' adequate' : ' below-target'} servicing performance.
              {' '}<strong>{num(p.paidOffCount)}</strong> loan{p.paidOffCount !== 1 ? 's' : ''} have been fully retired.
            </p>
          </div>
        </Section>

        {/* ═══ SECTION II — PORTFOLIO COMPOSITION ══════════════════════════════ */}
        <Section label="SECTION II" title="Portfolio Composition & Originations">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InfoBlock title="Origination Pipeline">
              <TableRow label="Total Principal Originated"  value={usd.format(p.totalPrincipalOriginated)} bold />
              <TableRow label="Total Disbursed"             value={usd.format(p.totalDisbursed)} />
              <TableRow label="Active Portfolio (Outstanding)" value={usd.format(p.activePortfolio)} bold />
              <TableRow label="Fully Paid Off"              value={`${num(p.paidOffCount)} loans`} />
              <hr className="my-2" style={{ borderColor: C.border }} />
              <TableRow label="Legacy Client Applications"  value={num(stats.totalLoans)} />
              <TableRow label="Applications Approved"       value={`${num(stats.approvedCount)} (${pct(stats.approvedCount / Math.max(stats.totalLoans, 1) * 100)})`} />
              <TableRow label="Applications Pending"        value={num(stats.pendingCount)} />
              <TableRow label="Applications Denied"         value={num(stats.deniedCount)} />
            </InfoBlock>

            <InfoBlock title="Loan Lifecycle Distribution">
              {lifecycleData.length === 0
                ? <p className="text-sm text-slate-400 py-4 text-center">No lifecycle data</p>
                : (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={lifecycleData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: C.slate }} />
                        <YAxis dataKey="label" type="category" width={90} tick={{ fontSize: 11, fill: C.navy }} />
                        <Tooltip formatter={(v: number) => [num(v), 'Loans']} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {lifecycleData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              }
            </InfoBlock>
          </div>

          {/* By Risk Profile */}
          {stats.byProfile.length > 0 && (
            <InfoBlock title="Originations by Risk Profile">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                      <Th>Risk Profile</Th>
                      <Th align="right">Loans</Th>
                      <Th align="right">Share</Th>
                      <Th align="right">Principal</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byProfile.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <Td>{row.profile ?? '—'}</Td>
                        <Td align="right">{num(row.count)}</Td>
                        <Td align="right">{pct(row.count / Math.max(stats.totalLoans, 1) * 100)}</Td>
                        <Td align="right">{usd.format(row.totalAmount)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </InfoBlock>
          )}
        </Section>

        {/* ═══ SECTION III — COLLECTIONS & REVENUE ═══════════════════════════ */}
        <Section label="SECTION III" title="Collections Performance & Revenue Analysis">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <MetricCard label="Collected Today"  value={usd.format(stats.collectedToday)}  />
            <MetricCard label="Collected This Week"  value={usd.format(stats.collectedWeek)}  delta={metrics.weekDelta} />
            <MetricCard label="Collected This Month" value={usd.format(stats.collectedMonth)} delta={metrics.monthDelta} />
            <MetricCard label="Installments Due Today" value={usd.format(p.dueTodayAmount)} sub={`${num(p.dueTodayCount)} installments`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InfoBlock title="Period-over-Period Revenue Comparison">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: C.slate }} />
                    <YAxis tick={{ fontSize: 11, fill: C.slate }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: number) => usd.format(v)} />
                    <Bar dataKey="amount" name="Collected" radius={[4, 4, 0, 0]}>
                      {revenueChartData.map((entry, i) => (
                        <Cell key={i} fill={i % 2 === 1 ? C.blue : '#93C5FD'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </InfoBlock>

            <InfoBlock title="Capital Recovery by Currency">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                      <Th>Currency</Th>
                      <Th align="right">Originated</Th>
                      <Th align="right">Recovered</Th>
                      <Th align="right">Recovery %</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recoveryByCurrency.length === 0
                      ? <tr><td colSpan={4} className="text-center py-4 text-slate-400 text-sm">No recovery data</td></tr>
                      : stats.recoveryByCurrency.map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <Td><span className="font-bold">{r.currency}</span></Td>
                          <Td align="right">{usd.format(r.totalAmount)}</Td>
                          <Td align="right">{usd.format(r.totalRecovered)}</Td>
                          <Td align="right">
                            <span style={{ color: r.percentage >= 70 ? C.green : r.percentage >= 40 ? C.gold : C.red }} className="font-bold">
                              {pct(r.percentage)}
                            </span>
                          </Td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </InfoBlock>
          </div>
        </Section>

        {/* ═══ SECTION IV — CREDIT RISK & DELINQUENCY ════════════════════════ */}
        <Section label="SECTION IV" title="Credit Risk & Delinquency Analysis">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InfoBlock title="Risk Exposure Summary">
              <TableRow label="Non-Performing Loans (NPL)" value={num(p.delinquentCount)} bold />
              <TableRow label="NPL Ratio"                  value={pct(metrics.nplRatio)} bold color={metrics.nplRatio > 10 ? C.red : metrics.nplRatio > 5 ? C.gold : C.green} />
              <TableRow label="Overdue Balance Exposure"   value={usd.format(p.overdueAmountTotal)} bold color={p.overdueAmountTotal > 0 ? C.red : undefined} />
              <TableRow label="Capital at Risk (% Active Portfolio)" value={pct(metrics.capitalAtRisk)} color={metrics.capitalAtRisk > 15 ? C.red : metrics.capitalAtRisk > 7 ? C.gold : C.green} />
              <hr className="my-2" style={{ borderColor: C.border }} />
              <TableRow label="Active Loans"               value={num(p.totalActiveCount)} />
              <TableRow label="Delinquent Loans"           value={num(p.delinquentCount)} />
              <TableRow label="Loans Paid Off (Retired)"   value={num(p.paidOffCount)} />
            </InfoBlock>

            <InfoBlock title="Overdue Exposure by Currency">
              {stats.overdueAmountByCurrency.length === 0
                ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <p className="text-2xl">✓</p>
                      <p className="text-sm font-semibold mt-1" style={{ color: C.green }}>No overdue balances detected</p>
                    </div>
                  </div>
                )
                : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                        <Th>Currency</Th>
                        <Th align="right">Overdue Amount</Th>
                        <Th align="right">% of Active Portfolio</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.overdueAmountByCurrency.map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <Td><span className="font-bold">{row.currency}</span></Td>
                          <Td align="right"><span style={{ color: C.red }} className="font-bold">{usd.format(row.amount)}</span></Td>
                          <Td align="right">{pct(p.activePortfolio > 0 ? row.amount / p.activePortfolio * 100 : 0)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </InfoBlock>
          </div>
        </Section>

        {/* ═══ SECTION V — BRANCH PERFORMANCE ════════════════════════════════ */}
        <Section label="SECTION V" title="Branch Distribution & Channel Performance">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InfoBlock title="Channel Breakdown">
              <TableRow label="Sede (Branch Office)"   value={`${num(stats.byBranch.sede)} clients (${pct(stats.byBranchPerformance.sede.percentage)})`} bold />
              <TableRow label="Rutas (Field Routes)"   value={`${num(stats.byBranch.rutas)} clients (${pct(stats.byBranchPerformance.rutas.percentage)})`} bold />
              <TableRow label="Top Performing Channel" value={
                stats.byBranchPerformance.topBranch === 'tie' ? 'Tied'
                : stats.byBranchPerformance.topBranch === 'sede' ? 'Sede'
                : 'Rutas'
              } color={C.blue} />
              <hr className="my-2" style={{ borderColor: C.border }} />
              <TableRow label="Total Clients Served"   value={num(stats.totalClients)} />
            </InfoBlock>

            <InfoBlock title="Channel Distribution">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Sede', value: stats.byBranch.sede },
                        { name: 'Rutas', value: stats.byBranch.rutas },
                      ]}
                      cx="50%" cy="50%"
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${pct((percent ?? 0) * 100)}`}
                      labelLine={false}
                    >
                      <Cell fill={C.navy} />
                      <Cell fill={C.blue} />
                    </Pie>
                    <Tooltip formatter={(v: number) => [num(v), 'Clients']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </InfoBlock>
          </div>
        </Section>

        {/* ═══ SECTION VI — RECENT ORIGINATIONS ══════════════════════════════ */}
        {stats.recentClients.length > 0 && (
          <Section label="SECTION VI" title="Recent Loan Originations (Last 5)">
            <InfoBlock title="Most Recent Client Applications">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.navy}` }}>
                      <Th>Borrower</Th>
                      <Th>Profile</Th>
                      <Th align="right">Principal</Th>
                      <Th align="right">Monthly Pmt</Th>
                      <Th>Currency</Th>
                      <Th>Date</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentClients.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : C.bg }}>
                        <Td>
                          <p className="font-semibold">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.email}</p>
                        </Td>
                        <Td>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#EEF4FF', color: C.navy }}>
                            {c.profile ?? '—'}
                          </span>
                        </Td>
                        <Td align="right" bold>{usd.format(c.amount ?? 0)}</Td>
                        <Td align="right">{usd.format(c.monthlyPayment ?? 0)}</Td>
                        <Td><span className="font-mono text-xs">{c.currency ?? 'USD'}</span></Td>
                        <Td>{c.savedAt ? new Date(c.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </InfoBlock>
          </Section>
        )}

        {/* ─── FOOTER / DISCLAIMER ─────────────────────────────────────────── */}
        <div className="rounded-xl border p-4 text-xs" style={{ borderColor: C.border, color: C.slate }}>
          <p className="font-bold mb-1" style={{ color: C.navy }}>IMPORTANT DISCLOSURES</p>
          <p>
            This report is generated automatically and is intended for internal management use only.
            All monetary figures are denominated in USD using live exchange rates as of the report generation time.
            Exchange rates: {Object.entries(stats.exchangeRatesPerUsd).map(([cur, rate]) => `1 USD = ${rate} ${cur}`).join(' · ')}.
            Past performance metrics are not indicative of future results. Capital at Risk and NPL figures are estimates based on
            current system data and may not reflect real-time delinquency status. This document is classified
            <strong> CONFIDENTIAL</strong> and should not be distributed outside authorized personnel.
          </p>
          <p className="mt-2">
            Report generated: {reportDate.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' })}
          </p>
        </div>

      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-bold tracking-widest px-2 py-0.5 rounded" style={{ background: C.navy, color: C.gold }}>
          {label}
        </span>
        <h2 className="text-base sm:text-lg font-bold" style={{ color: C.navy }}>{title}</h2>
        <div className="flex-1 h-px" style={{ background: C.border }} />
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4 bg-white" style={{ borderColor: C.border }}>
      <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: C.slate }}>{title}</p>
      {children}
    </div>
  )
}

function CoverKpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#93C5FD' }}>{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{sub}</p>}
    </div>
  )
}

function RatioCard({ label, value, status, sub }: { label: string; value: string; status: 'good' | 'warn' | 'bad' | 'neutral'; sub?: string }) {
  const colors = { good: { bg: '#F0FDF4', border: '#BBF7D0', text: C.green }, warn: { bg: '#FFFBEB', border: '#FDE68A', text: C.gold }, bad: { bg: '#FEF2F2', border: '#FECACA', text: C.red }, neutral: { bg: '#EFF6FF', border: '#BFDBFE', text: C.blue } }
  const col = colors[status]
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: col.bg, border: `1px solid ${col.border}` }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: C.slate }}>{label}</p>
      <p className="text-lg font-bold" style={{ color: col.text }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: C.slate }}>{sub}</p>}
    </div>
  )
}

function MetricCard({ label, value, delta, sub }: { label: string; value: string; delta?: number; sub?: string }) {
  const positive = delta === undefined || delta >= 0
  return (
    <div className="rounded-xl border p-3 bg-white" style={{ borderColor: C.border }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: C.slate }}>{label}</p>
      <p className="text-lg font-bold" style={{ color: C.navy }}>{value}</p>
      {delta !== undefined && (
        <p className="text-xs font-semibold mt-0.5" style={{ color: positive ? C.green : C.red }}>
          {positive ? '▲' : '▼'} {delta > 0 ? '+' : ''}{delta.toFixed(1)}% vs prior period
        </p>
      )}
      {sub && <p className="text-[10px] mt-0.5" style={{ color: C.slate }}>{sub}</p>}
    </div>
  )
}

function TableRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.slate }}>{label}</span>
      <span className={bold ? 'font-bold' : 'font-medium'} style={{ color: color ?? C.navy }}>{value}</span>
    </div>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' | 'left' }) {
  return (
    <th className="py-2 px-2 text-xs font-bold uppercase tracking-wide" style={{ color: C.navy, textAlign: align ?? 'left' }}>
      {children}
    </th>
  )
}

function Td({ children, align, bold }: { children: React.ReactNode; align?: 'right' | 'left'; bold?: boolean }) {
  return (
    <td className={`py-2 px-2 text-sm ${bold ? 'font-bold' : ''}`} style={{ color: C.navy, textAlign: align ?? 'left' }}>
      {children}
    </td>
  )
}
