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
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface StatsData {
  totalClients: number
  totalLoans: number
  approvedCount: number
  pendingCount: number
  deniedCount: number
  totalMonthlyIncome: number
  collectedToday: number
  collectedWeek: number
  collectedWeekPrev: number
  collectedMonth: number
  collectedMonthPrev: number
  collectionRate: number
  paidPeriodsCount: number
  byCurrency: { currency: string; count: number; totalAmount: number }[]
  byProfile: { profile: string; count: number; totalAmount: number }[]
  recoveryByCurrency: { currency: string; totalAmount: number; totalRecovered: number; percentage: number }[]
  exchangeRatesPerUsd: Record<string, number>
  portfolio: {
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
    byLifecycle: { status: string; count: number }[]
  }
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const num = (n: number) => n.toLocaleString('en-US')
const pct = (n: number) => `${n.toFixed(1)}%`

const LIFECYCLE_LABELS: Record<string, string> = {
  application_submitted: 'Solicitud enviada',
  under_review: 'En revisión',
  approved: 'Aprobado',
  disbursed: 'Desembolsado',
  active: 'Activo',
  delinquent: 'Moroso',
  paid_off: 'Pagado',
  defaulted: 'Incobrable',
  denied: 'Denegado',
  cancelled: 'Cancelado',
}

export default function OrganizationReport() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [orgName, setOrgName] = useState('—')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        if (!orgRes.ok || !statsRes.ok) throw new Error('No se pudo cargar el reporte financiero.')
        const orgJson = await orgRes.json()
        const statsJson = await statsRes.json()
        if (!mounted) return
        setOrgName(orgJson?.orgName ?? '—')
        setStats(statsJson)
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Error inesperado')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const analysis = useMemo(() => {
    if (!stats) return null
    const p = stats.portfolio
    const npl = p.totalActiveCount > 0 ? (p.delinquentCount / p.totalActiveCount) * 100 : 0
    const capitalAtRisk = p.activePortfolio > 0 ? (p.overdueAmountTotal / p.activePortfolio) * 100 : 0
    const weeklyDelta = stats.collectedWeekPrev > 0
      ? ((stats.collectedWeek - stats.collectedWeekPrev) / stats.collectedWeekPrev) * 100
      : 0
    const monthlyDelta = stats.collectedMonthPrev > 0
      ? ((stats.collectedMonth - stats.collectedMonthPrev) / stats.collectedMonthPrev) * 100
      : 0
    const recovery = stats.recoveryByCurrency.length > 0
      ? stats.recoveryByCurrency.reduce((acc, r) => acc + r.percentage, 0) / stats.recoveryByCurrency.length
      : 0
    const annualizedYield = p.activePortfolio > 0
      ? ((stats.totalMonthlyIncome * 12) / p.activePortfolio) * 100
      : 0

    return { npl, capitalAtRisk, weeklyDelta, monthlyDelta, recovery, annualizedYield }
  }, [stats])

  const lifecycleData = useMemo(() => (
    stats?.portfolio.byLifecycle
      .map(i => ({ name: LIFECYCLE_LABELS[i.status] ?? i.status, count: i.count }))
      .sort((a, b) => b.count - a.count) ?? []
  ), [stats])

  const collectionData = useMemo(() => {
    if (!stats) return []
    return [
      { period: 'Semana ant.', amount: stats.collectedWeekPrev },
      { period: 'Semana act.', amount: stats.collectedWeek },
      { period: 'Mes ant.', amount: stats.collectedMonthPrev },
      { period: 'Mes act.', amount: stats.collectedMonth },
    ]
  }, [stats])

  if (loading) return <PanelState text="Construyendo dashboard financiero..." />
  if (error) return <PanelState text={error} danger />
  if (!stats || !analysis) return null

  const p = stats.portfolio
  const alerts = [
    analysis.npl > 7 ? `NPL en ${pct(analysis.npl)}: elevar estrategia de cobranza temprana.` : null,
    analysis.capitalAtRisk > 10 ? `Capital en riesgo en ${pct(analysis.capitalAtRisk)}: revisar políticas de aprobación.` : null,
    p.pendingApprovalCount > 10 ? `${num(p.pendingApprovalCount)} solicitudes pendientes: riesgo operativo en tiempo de respuesta.` : null,
    p.dueTodayAmount > 0 ? `Vencimientos de hoy por ${money.format(p.dueTodayAmount)} (${num(p.dueTodayCount)} cuotas).` : null,
  ].filter(Boolean) as string[]

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <section className="rounded-3xl p-4 sm:p-6 text-white" style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)' }}>
        <p className="text-[10px] sm:text-xs font-bold tracking-[0.16em] uppercase text-blue-200">Reporte estratégico financiero</p>
        <h1 className="text-xl sm:text-3xl font-bold mt-1">Panel ejecutivo · {orgName}</h1>
        <p className="text-xs sm:text-sm text-blue-100 mt-2">
          Enfoque de analista institucional: rentabilidad, riesgo, liquidez y eficiencia de cobranza para soporte de decisiones de dirección.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mt-4">
          <Kpi title="Cartera activa" value={money.format(p.activePortfolio)} sub={`${num(p.totalActiveCount)} préstamos`} />
          <Kpi title="Desembolso total" value={money.format(p.totalDisbursed)} sub="histórico" />
          <Kpi title="Ingreso mensual" value={money.format(stats.totalMonthlyIncome)} sub="flujo esperado" />
          <Kpi title="Aprobación" value={pct(p.approvalRate * 100)} sub={`${num(stats.approvedCount)} aprobados`} />
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Metric title="NPL" value={pct(analysis.npl)} tone={analysis.npl > 10 ? 'bad' : analysis.npl > 5 ? 'warn' : 'good'} hint="Morosidad / activos" />
        <Metric title="Capital en riesgo" value={pct(analysis.capitalAtRisk)} tone={analysis.capitalAtRisk > 12 ? 'bad' : analysis.capitalAtRisk > 6 ? 'warn' : 'good'} hint="Overdue / cartera" />
        <Metric title="Yield anualizado" value={pct(analysis.annualizedYield)} tone="neutral" hint="Ingreso anualizado" />
        <Metric title="Recuperación" value={pct(analysis.recovery)} tone={analysis.recovery >= 70 ? 'good' : 'warn'} hint="Promedio por moneda" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Card title="Evolución de cobranza">
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => money.format(v)} />
                <Bar dataKey="amount" fill="#1D4ED8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Semana: <strong className={analysis.weeklyDelta >= 0 ? 'text-emerald-700' : 'text-red-700'}>{analysis.weeklyDelta >= 0 ? '▲' : '▼'} {analysis.weeklyDelta.toFixed(1)}%</strong>
            {' '}· Mes: <strong className={analysis.monthlyDelta >= 0 ? 'text-emerald-700' : 'text-red-700'}>{analysis.monthlyDelta >= 0 ? '▲' : '▼'} {analysis.monthlyDelta.toFixed(1)}%</strong>
          </p>
        </Card>

        <Card title="Distribución del ciclo de vida">
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={lifecycleData} dataKey="count" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {lifecycleData.map((_, i) => (
                    <Cell key={i} fill={['#1D4ED8', '#0EA5E9', '#0F766E', '#16A34A', '#F59E0B', '#DC2626', '#7C3AED'][i % 7]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, _n, p2: any) => [num(v), p2?.payload?.name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            {lifecycleData.slice(0, 6).map(row => (
              <p key={row.name} className="text-slate-600">• {row.name}: <strong>{num(row.count)}</strong></p>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
        <Card title="Riesgo y alertas prioritarias" className="xl:col-span-2">
          {alerts.length === 0 ? (
            <p className="text-sm text-emerald-700">Sin alertas críticas. La cartera se encuentra bajo control operativo.</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((alert, i) => (
                <li key={i} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">⚠️ {alert}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold">Recomendación de analista</p>
            <p>
              Priorizar seguimiento de mora temprana (1-7 días), reforzar scoring para perfiles con baja recuperación
              y ejecutar comité semanal de aprobación para reducir pendientes sin comprometer calidad crediticia.
            </p>
          </div>
        </Card>

        <Card title="Radar de decisiones">
          <DecisionRow label="Aumentar originación" status={analysis.npl < 6 && analysis.monthlyDelta >= 0 ? 'Sí' : 'Con cautela'} />
          <DecisionRow label="Endurecer crédito" status={analysis.capitalAtRisk > 8 ? 'Sí' : 'No inmediato'} />
          <DecisionRow label="Refuerzo cobranza" status={p.delinquentCount > 0 ? 'Prioridad alta' : 'Monitoreo'} />
          <DecisionRow label="Liquidez operativa" status={stats.collectedMonth >= stats.collectedMonthPrev ? 'Estable' : 'Ajustar gastos'} />
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Card title="Composición por moneda">
          <div className="space-y-2">
            {stats.byCurrency.map(cur => (
              <div key={cur.currency} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-600">{cur.currency}</span>
                <span className="font-bold text-slate-900">{num(cur.count)} préstamos · {money.format(cur.totalAmount)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Recuperación por moneda">
          <div className="space-y-2">
            {stats.recoveryByCurrency.map(cur => (
              <div key={cur.currency} className="rounded-xl border border-slate-100 p-2.5">
                <p className="text-sm font-semibold text-slate-800">{cur.currency} · {pct(cur.percentage)}</p>
                <p className="text-xs text-slate-500">Recuperado {money.format(cur.totalRecovered)} de {money.format(cur.totalAmount)}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
        Tipo de cambio de referencia: {Object.entries(stats.exchangeRatesPerUsd).map(([cur, rate]) => `1 USD = ${rate} ${cur}`).join(' · ')}.
        Datos para uso interno de dirección financiera.
      </div>
    </div>
  )
}

function PanelState({ text, danger }: { text: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl border px-4 py-16 text-center" style={{ borderColor: danger ? '#FECACA' : '#BFDBFE', background: danger ? '#FEF2F2' : '#EFF6FF' }}>
      <p className="font-semibold" style={{ color: danger ? '#B91C1C' : '#1E3A8A' }}>{text}</p>
    </div>
  )
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 ${className}`}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2.5">{title}</h3>
      {children}
    </div>
  )
}

function Kpi({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-blue-100 font-semibold">{title}</p>
      <p className="text-base sm:text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] text-blue-200">{sub}</p>
    </div>
  )
}

function Metric({ title, value, hint, tone }: { title: string; value: string; hint: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const tones = {
    good: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warn: 'bg-amber-50 border-amber-200 text-amber-800',
    bad: 'bg-red-50 border-red-200 text-red-800',
    neutral: 'bg-blue-50 border-blue-200 text-blue-800',
  }
  return (
    <div className={`rounded-xl border p-2.5 ${tones[tone]}`}>
      <p className="text-[10px] uppercase tracking-wider font-bold">{title}</p>
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="text-[10px] opacity-75">{hint}</p>
    </div>
  )
}

function DecisionRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-700">{status}</span>
    </div>
  )
}
