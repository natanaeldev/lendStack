'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { formatCurrency, RISK_PROFILES, Currency } from '@/lib/loan'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatsData {
  configured: boolean
  totalClients: number; totalLoans: number; totalAmount: number
  avgMonthlyPayment: number; avgAmount: number; totalInterest: number
  avgTermMonths: number; totalMonthlyPayments: number
  totalMonthlyIncome: number; approvedCapital: number
  pendingCount: number; approvedCount: number; deniedCount: number
  collectedToday: number; collectedWeek: number; collectedMonth: number
  collectionRate: number; paidPeriodsCount: number
  overdueAmountByCurrency: { currency: string; amount: number }[]
  byProfile:            { profile: string; count: number; totalAmount: number }[]
  byCurrency:           { currency: string; count: number; totalAmount: number }[]
  avgPaymentByCurrency:  { currency: string; avgMonthlyPayment: number; count: number }[]
  recoveryByCurrency:    { currency: string; totalAmount: number; totalRecovered: number; percentage: number }[]
  recentClients: RecentClient[]
  baseCurrency?: 'USD'
  exchangeRatesPerUsd?: Record<string, number>
  portfolio?: {
    totalLoansCount: number; totalDisbursed: number; activePortfolio: number
    totalActiveCount: number; delinquentCount: number; overdueAmountTotal: number
    totalPrincipalOriginated?: number
    paidOffCount: number; pendingApprovalCount: number
    approvalRate: number; dueTodayCount: number; dueTodayAmount: number
    collectedMonth: number
    byLifecycle: { status: string; count: number }[]
  }
}
interface RecentClient {
  id: string; name: string; email: string; savedAt: string
  amount: number; profile: string; currency: Currency; monthlyPayment: number
}
interface ClientDoc {
  id: string; name: string; url: string; type: string; size: number; uploadedAt: string
}
interface ClientRow {
  id: string; name: string; email: string; phone: string; notes: string; savedAt: string
  params: any; result: any; documents: ClientDoc[]; loanStatus?: string
  payments?: { id: string; date: string; amount: number; cuotaNumber?: number; notes?: string }[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROFILE_COLOR: Record<string, string> = {
  'Low Risk': '#2E7D32', 'Medium Risk': '#F59E0B', 'High Risk': '#EF4444',
}
const CURRENCY_COLORS = ['#1565C0', '#0D2B5E', '#2E7D32', '#F59E0B']

const STATUS_CFG: Record<string, { label: string; emoji: string; bg: string; color: string }> = {
  pending:  { label: 'Pendiente', emoji: '⏳', bg: '#FFFBEB', color: '#92400E' },
  approved: { label: 'Aprobado',  emoji: '✅', bg: '#F0FDF4', color: '#14532D' },
  denied:   { label: 'Denegado',  emoji: '❌', bg: '#FFF1F2', color: '#881337' },
}

const SECTION_BAR = (
  <div className="w-1 h-6 rounded-full flex-shrink-0"
    style={{ background: 'linear-gradient(180deg,#1565C0,#0D2B5E)' }} />
)

// ─── Sub-components ───────────────────────────────────────────────────────────

// ─── KPI card variants ────────────────────────────────────────────────────────

/** Primary KPI — large value, colored accent strip on left */
function KpiCard({
  label, value, sub, accent, icon, badge,
}: {
  label: string; value: string; sub?: string
  accent: string; icon: string; badge?: { text: string; color: string; bg: string }
}) {
  return (
    <div className="relative rounded-2xl bg-white border border-slate-200 overflow-hidden"
      style={{ boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
      {/* Left accent strip */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: accent }} />
      <div className="pl-6 pr-5 py-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 leading-tight">{label}</p>
          <span className="text-xl flex-shrink-0">{icon}</span>
        </div>
        <p className="font-display text-3xl font-black leading-none mb-1.5" style={{ color: '#0D2B5E' }}>
          {value}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
          {badge && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: badge.bg, color: badge.color }}>
              {badge.text}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Secondary metric — compact, horizontal layout */
function MetricRow({
  label, value, sub, icon, accent,
}: { label: string; value: string; sub?: string; icon: string; accent: string }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200"
      style={{ boxShadow: '0 2px 10px rgba(0,0,0,.05)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: accent + '18' }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
        <p className="font-display text-lg font-bold leading-none" style={{ color: '#0D2B5E' }}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SetupScreen() {
  return (
    <div className="rounded-2xl p-10 bg-white border border-slate-200 text-center"
      style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
      <p className="text-5xl mb-4">🗄️</p>
      <h2 className="font-display text-2xl mb-2" style={{ color: '#0D2B5E' }}>Conectar MongoDB</h2>
      <p className="text-slate-500 mb-6 text-sm max-w-md mx-auto">
        LendStack usa <strong>MongoDB Atlas</strong> como base de datos en la nube.
        Configurá la variable de entorno para habilitar el dashboard.
      </p>

      <div className="rounded-xl p-5 bg-slate-50 border border-slate-200 text-left max-w-lg mx-auto mb-6 font-mono text-xs space-y-1.5">
        <p className="font-sans text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Variables requeridas — .env.local
        </p>
        {[
          ['MONGODB_URI',           'mongodb+srv://user:pass@cluster.mongodb.net/jvf'],
          ['BLOB_READ_WRITE_TOKEN', 'vercel_blob_xxxx  ← para subir documentos'],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-blue-600 font-bold">{k}</span>
            <span className="text-slate-400">=</span>
            <span className="text-slate-500">{v}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-3 flex-wrap">
        <a href="https://www.mongodb.com/cloud/atlas/register"
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
          🚀 Crear cuenta MongoDB Atlas (gratis)
        </a>
        <a href="https://vercel.com/docs/storage/vercel-blob"
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border-2"
          style={{ color: '#1565C0', borderColor: '#1565C0' }}>
          📦 Vercel Blob (documentos)
        </a>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface DashboardProps {
  onViewProfile?: (id: string) => void
}

interface OrgInfo {
  plan:        string
  clientCount: number
  maxClients:  number | null
  isAtLimit:   boolean
  isNearLimit: boolean
  orgName:     string
}

export default function Dashboard({ onViewProfile }: DashboardProps = {}) {
  const [stats,    setStats]    = useState<StatsData | null>(null)
  const [clients,  setClients]  = useState<ClientRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [notConf,  setNotConf]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [uploading,setUploading]= useState<string | null>(null)
  const [expandDoc,setExpandDoc]= useState<string | null>(null)
  const [orgInfo,  setOrgInfo]  = useState<OrgInfo | null>(null)
  const [dashboardCurrency, setDashboardCurrency] = useState<Currency>('USD')
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/org').then(r => r.json()).catch(() => null),
    ])
      .then(([s, c, org]) => {
        // configured is false (503) OR undefined (500 error) → show setup screen
        if (!s.configured) { setNotConf(true); return }
        setStats(s)
        setClients(c.clients ?? [])
        if (org && !org.error) setOrgInfo(org)
      })
      .catch(() => setNotConf(true))
      .finally(() => setLoading(false))
  }, [])

  // ── Filtered clients ────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    clients.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    ), [clients, search])

  // ── Document upload ─────────────────────────────────────────────────────────
  const handleUpload = async (clientId: string, file: File) => {
    setUploading(clientId)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, { method: 'POST', body: form })
      if (res.ok) {
        const { document } = await res.json()
        setClients(prev => prev.map(c =>
          c.id === clientId ? { ...c, documents: [...(c.documents ?? []), document] } : c
        ))
      }
    } finally {
      setUploading(null)
    }
  }

  // ── Delete client ───────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente permanentemente?')) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    setClients(prev => prev.filter(c => c.id !== id))
    if (stats) setStats(s => s ? { ...s, totalClients: s.totalClients - 1, totalLoans: s.totalLoans - 1 } : s)
  }

  const usdToSelected = (amountUsd: number) => {
    if (dashboardCurrency === 'USD') return amountUsd
    const rate = stats?.exchangeRatesPerUsd?.[dashboardCurrency] ?? 1
    return amountUsd * rate
  }
  const fmt = (vUsd: number) => formatCurrency(usdToSelected(vUsd), dashboardCurrency)
  const fmtLoan = (v: number, cur: Currency = 'USD') => formatCurrency(v, cur)
  const fmtK = (nUsd: number) => {
    const n = usdToSelected(nUsd)
    const symbol = dashboardCurrency === 'DOP' ? 'RD$' : '$'
    return n >= 1_000_000
      ? `${symbol}${(n / 1_000_000).toFixed(2)}M`
      : n >= 1_000
      ? `${symbol}${(n / 1_000).toFixed(0)}K`
      : `${symbol}${Math.round(n).toLocaleString('es-AR')}`
  }

  // ── Paid this month helper ──────────────────────────────────────────────────
  const yearMonth = (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })()
  const isPaidThisMonth = (c: ClientRow) =>
    (c.payments ?? []).some(p => p.date?.startsWith(yearMonth))

  // ── Render helpers ──────────────────────────────────────────────────────────
  const docIcon = (type: string) =>
    type.includes('pdf') ? '📄' : type.includes('image') ? '🖼️' : type.includes('word') ? '📝' : '📁'

  // ── Early returns ───────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center text-slate-400">
        <p className="text-5xl mb-3 animate-pulse">⏳</p>
        <p className="text-sm">Cargando dashboard...</p>
      </div>
    </div>
  )

  if (notConf) return <SetupScreen />

  // ── Full dashboard ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 sm:space-y-6">

      {/* ── Plan banner (Starter limit warning / Pro badge) ── */}
      {orgInfo && orgInfo.plan === 'starter' && orgInfo.maxClients !== null && (
        <div
          className="rounded-2xl px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
          style={{
            background:  orgInfo.isAtLimit  ? '#FFF1F2' : orgInfo.isNearLimit ? '#FFFBEB' : '#F0F9FF',
            border:      `1.5px solid ${orgInfo.isAtLimit ? '#FECDD3' : orgInfo.isNearLimit ? '#FDE68A' : '#BAE6FD'}`,
          }}
        >
          <div className="flex items-start sm:items-center gap-3 w-full sm:w-auto">
            <span className="text-xl">{orgInfo.isAtLimit ? '🚫' : orgInfo.isNearLimit ? '⚠️' : '📊'}</span>
            <div>
              <p
                className="text-sm font-bold"
                style={{ color: orgInfo.isAtLimit ? '#9F1239' : orgInfo.isNearLimit ? '#92400E' : '#0C4A6E' }}
              >
                Plan Starter — {orgInfo.clientCount} / {orgInfo.maxClients} clientes
              </p>
              <p
                className="text-xs"
                style={{ color: orgInfo.isAtLimit ? '#BE123C' : orgInfo.isNearLimit ? '#B45309' : '#0369A1' }}
              >
                {orgInfo.isAtLimit
                  ? 'Límite alcanzado. Actualizá al plan Pro para agregar más clientes.'
                  : orgInfo.isNearLimit
                    ? 'Estás cerca del límite del plan gratuito.'
                    : `Te quedan ${orgInfo.maxClients - orgInfo.clientCount} clientes disponibles en el plan gratuito.`}
              </p>
            </div>
          </div>
          {(orgInfo.isAtLimit || orgInfo.isNearLimit) && (
            <a
              href="mailto:ventas@lendstack.app?subject=Actualizar%20a%20Pro"
              className="w-full sm:w-auto text-center flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}
            >
              ⭐ Actualizar a Pro
            </a>
          )}
        </div>
      )}
      {orgInfo && orgInfo.plan !== 'starter' && (
        <div
          className="rounded-2xl px-5 py-3 flex items-center gap-3"
          style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC' }}
        >
          <span className="text-base">✅</span>
          <p className="text-sm font-semibold" style={{ color: '#14532D' }}>
            Plan {orgInfo.plan.charAt(0).toUpperCase() + orgInfo.plan.slice(1)} activo — clientes y usuarios ilimitados
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           KPI SECTION
         ══════════════════════════════════════════════════════════════════════ */}
      {stats && (() => {
        const total    = stats.totalLoans || 1
        const approvalRate = total > 0
          ? Math.round((stats.approvedCount / total) * 100)
          : 0
        const highRisk = stats.byProfile.find(p => p.profile === 'High Risk')?.count ?? 0
        const avgTerm  = Math.round(stats.avgTermMonths || 0)

        return (
          <>
            {/* ── Section header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {SECTION_BAR}
                <h3 className="font-display text-base" style={{ color: '#0D2B5E' }}>Resumen de cartera</h3>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                <span className="text-xs text-slate-400 leading-tight">
                  {stats.totalClients} cliente{stats.totalClients !== 1 ? 's' : ''} · actualizado ahora
                </span>
                <select
                  value={dashboardCurrency}
                  onChange={e => setDashboardCurrency(e.target.value as Currency)}
                  className="text-xs font-semibold rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white"
                >
                  <option value="USD">USD ($)</option>
                  <option value="DOP">RD$ (DOP)</option>
                </select>
              </div>
            </div>

            {/* ── Primary KPIs (4 large cards) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Cartera total — desglosada por moneda */}
              <div className="relative rounded-2xl bg-white border border-slate-200 overflow-hidden"
                style={{ boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: '#1565C0' }} />
                <div className="pl-6 pr-5 py-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 leading-tight">Cartera total</p>
                    <span className="text-xl flex-shrink-0">💼</span>
                  </div>
                  <p className="font-display text-3xl font-black leading-none mb-1.5" style={{ color: '#0D2B5E' }}>
                    {fmtK(stats.portfolio?.totalPrincipalOriginated ?? stats.totalAmount)}
                  </p>
                  <p className="text-xs text-slate-400">principal originado (excluye cancelados/denegados/borradores)</p>
                </div>
              </div>
              <KpiCard
                label="Tasa de aprobación"
                value={`${approvalRate}%`}
                sub={`${stats.approvedCount} de ${total} aprobados`}
                accent="#2E7D32"
                icon="✅"
                badge={
                  approvalRate >= 70
                    ? { text: 'Saludable', color: '#14532D', bg: '#F0FDF4' }
                    : approvalRate >= 40
                    ? { text: 'Normal', color: '#92400E', bg: '#FFFBEB' }
                    : { text: 'Bajo', color: '#881337', bg: '#FFF1F2' }
                }
              />
              <KpiCard
                label="Ticket promedio"
                value={fmtK(stats.avgAmount)}
                sub="por préstamo"
                accent="#7C3AED"
                icon="🎫"
              />
              <KpiCard
                label="Plazo promedio"
                value={avgTerm > 0 ? `${avgTerm} meses` : '—'}
                sub={avgTerm > 0 ? `≈ ${(avgTerm / 12).toFixed(1)} años` : 'sin datos aún'}
                accent="#0891B2"
                icon="📅"
              />
            </div>

            {/* ── Secondary metrics (2×4 grid) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricRow
                label="Interés proyectado"
                value={fmtK(stats.totalInterest)}
                sub="en toda la cartera"
                icon="💰"
                accent="#F59E0B"
              />
              {/* Cuota promedio desglosada por moneda */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-200"
                style={{ boxShadow: '0 2px 10px rgba(0,0,0,.05)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: '#EEF4FF', border: '1px solid rgba(21,101,192,.2)' }}>
                  💳
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Cuota prom. mensual
                  </p>
                  {(stats.avgPaymentByCurrency ?? []).length === 0 ? (
                    <p className="text-sm font-bold text-slate-300">—</p>
                  ) : (
                    <div className="space-y-1">
                      {(stats.avgPaymentByCurrency ?? []).map(c => (
                        <div key={c.currency} className="flex items-center justify-between gap-2">
                          <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: '#EEF4FF', color: '#1565C0' }}>
                            {c.currency}
                          </span>
                          <span className="text-sm font-black tabular-nums" style={{ color: '#0D2B5E' }}>
                            {fmt(c.avgMonthlyPayment)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1.5">por préstamo</p>
                </div>
              </div>
              <MetricRow
                label="Ingresos mensuales"
                value={stats.totalMonthlyIncome > 0 ? fmtK(stats.totalMonthlyIncome) : fmtK(stats.totalMonthlyPayments)}
                sub="suma de cuotas"
                icon="📥"
                accent="#2E7D32"
              />
              <MetricRow
                label="Alto riesgo"
                value={`${highRisk} préstamo${highRisk !== 1 ? 's' : ''}`}
                sub={highRisk > 0 ? 'requieren seguimiento' : 'sin préstamos críticos'}
                icon="⚠️"
                accent="#EF4444"
              />
            </div>

            {/* ── Capital recovery section ── */}
            {(stats.recoveryByCurrency ?? []).length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200 p-5"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    {SECTION_BAR}
                    <h3 className="font-display text-base" style={{ color: '#0D2B5E' }}>Recuperación de cartera</h3>
                  </div>
                  <span className="text-xs text-slate-400">capital cobrado vs. capital prestado</span>
                </div>
                <div className="space-y-4">
                  {(stats.recoveryByCurrency ?? []).map(r => (
                    <div key={r.currency}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded"
                            style={{ background: '#EEF4FF', color: '#1565C0' }}>
                            {r.currency}
                          </span>
                          <span className="text-xs text-slate-500">
                            {fmtK(r.totalRecovered)} recuperado de {fmtK(r.totalAmount)}
                          </span>
                        </div>
                        <span className="text-sm font-black tabular-nums"
                          style={{ color: r.percentage >= 70 ? '#15803D' : r.percentage >= 40 ? '#92400E' : '#0D2B5E' }}>
                          {r.percentage}%
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(r.percentage, 100)}%`,
                            background: r.percentage >= 70
                              ? 'linear-gradient(90deg,#16A34A,#22C55E)'
                              : r.percentage >= 40
                              ? 'linear-gradient(90deg,#D97706,#F59E0B)'
                              : 'linear-gradient(90deg,#1565C0,#3B82F6)',
                          }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Collection stats strip (today / week / month) ── */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                {SECTION_BAR}
                <h3 className="font-display text-base" style={{ color: '#0D2B5E' }}>Recaudación</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                {[
                  { label: 'Hoy',       value: fmtK(stats.collectedToday), sub: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),    bg: '#F0FDF4', border: '#86EFAC', color: '#14532D', emoji: '📅' },
                  { label: 'Esta semana', value: fmtK(stats.collectedWeek),  sub: 'lunes → hoy', bg: '#EEF4FF', border: '#BFDBFE', color: '#1E40AF', emoji: '📆' },
                  { label: 'Este mes',  value: fmtK(stats.collectedMonth), sub: new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }), bg: '#FAF5FF', border: '#DDD6FE', color: '#6D28D9', emoji: '🗓️' },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl p-3 sm:p-5 border"
                    style={{ background: s.bg, borderColor: s.border, boxShadow: '0 2px 10px rgba(0,0,0,.05)' }}>
                    <div className="flex flex-col items-center gap-0.5 sm:hidden">
                      <span className="text-xl leading-none mb-0.5">{s.emoji}</span>
                      <div className="text-lg font-black leading-none text-center" style={{ color: s.color }}>{s.value}</div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-center mt-0.5" style={{ color: s.color }}>{s.label}</p>
                    </div>
                    <div className="hidden sm:block">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{s.emoji}</span>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
                      </div>
                      <p className="font-display text-2xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-xs mt-1 capitalize" style={{ color: s.color, opacity: 0.7 }}>{s.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Collection rate + overdue amount ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tasa de cobranza */}
              {(() => {
                const rate   = stats.collectionRate ?? 0
                const paid   = stats.paidPeriodsCount ?? 0
                const total  = stats.approvedCount ?? 0
                const badge  = rate >= 80
                  ? { text: 'Excelente', color: '#14532D', bg: '#F0FDF4' }
                  : rate >= 50
                  ? { text: 'Normal',    color: '#92400E', bg: '#FFFBEB' }
                  : { text: 'Atención',  color: '#881337', bg: '#FFF1F2' }
                const accent = rate >= 80 ? '#16A34A' : rate >= 50 ? '#D97706' : '#DC2626'
                return (
                  <KpiCard
                    label="Tasa de cobranza del mes"
                    value={`${rate}%`}
                    sub={total > 0 ? `${paid} de ${total} préstamos aprobados pagaron este mes` : 'sin préstamos aprobados'}
                    accent={accent}
                    icon="📊"
                    badge={total > 0 ? badge : undefined}
                  />
                )
              })()}

              {/* Atraso estimado */}
              <div className="relative rounded-2xl bg-white border border-slate-200 overflow-hidden"
                style={{ boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: '#DC2626' }} />
                <div className="pl-6 pr-5 py-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 leading-tight">Atraso estimado</p>
                    <span className="text-xl flex-shrink-0">⚠️</span>
                  </div>
                  {(stats.overdueAmountByCurrency ?? []).length === 0 ? (
                    <>
                      <p className="font-display text-3xl font-black leading-none mb-1.5" style={{ color: '#0D2B5E' }}>$0</p>
                      <p className="text-xs text-slate-400">sin atrasos detectados</p>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2 mb-1.5">
                        {(stats.overdueAmountByCurrency ?? []).map(r => (
                          <div key={r.currency} className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded"
                              style={{ background: '#FFF1F2', color: '#DC2626' }}>
                              {r.currency}
                            </span>
                            <span className="font-display text-xl font-black tabular-nums leading-none"
                              style={{ color: '#DC2626' }}>
                              {fmtK(r.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400">cuotas pendientes acumuladas</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Loan status strip ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
              {[
                { count: stats.pendingCount,  label: 'Pendientes', sub: 'en evaluación', bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', sub2: '#B45309', emoji: '⏳' },
                { count: stats.approvedCount, label: 'Aprobados',  sub: 'créditos activos', bg: '#F0FDF4', border: '#86EFAC', color: '#14532D', sub2: '#16A34A', emoji: '✅' },
                { count: stats.deniedCount,   label: 'Denegados',  sub: 'rechazados', bg: '#FFF1F2', border: '#FECDD3', color: '#881337', sub2: '#DC2626', emoji: '❌' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-3 sm:p-5 border"
                  style={{ background: s.bg, borderColor: s.border, boxShadow: '0 2px 10px rgba(0,0,0,.05)' }}>

                  {/* Mobile: vertical stack — avoids overflow in narrow 3-col grid */}
                  <div className="flex flex-col items-center gap-0.5 sm:hidden">
                    <span className="text-xl leading-none mb-0.5">{s.emoji}</span>
                    <div className="text-2xl font-black leading-none" style={{ color: s.color }}>{s.count}</div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-center mt-0.5" style={{ color: s.color }}>{s.label}</p>
                  </div>

                  {/* Desktop: horizontal layout */}
                  <div className="hidden sm:flex items-center gap-4">
                    <div className="text-3xl font-black leading-none" style={{ color: s.color }}>{s.count}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: s.sub2 }}>{s.sub}</p>
                    </div>
                    <span className="text-2xl ml-auto">{s.emoji}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
           OPERATIONAL PORTFOLIO — powered by loans collection
         ══════════════════════════════════════════════════════════════════════ */}
      {stats && (stats as any).portfolio && (() => {
        const p = (stats as any).portfolio as {
          totalLoansCount: number; totalDisbursed: number; activePortfolio: number
          totalActiveCount: number; delinquentCount: number; overdueAmountTotal: number
          paidOffCount: number; pendingApprovalCount: number
          approvalRate: number; dueTodayCount: number; dueTodayAmount: number
          collectedMonth: number
          byLifecycle: { status: string; count: number }[]
        }
        if (p.totalLoansCount === 0) return null

        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              {SECTION_BAR}
              <h3 className="font-display text-base" style={{ color: '#0D2B5E' }}>Operaciones — cartera activa</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Cartera activa',   value: fmtK(p.activePortfolio),     sub: `${p.totalActiveCount} préstamos`,          icon: '💼', accent: '#10B981', bg: '#ECFDF5' },
                { label: 'Total desembolsado', value: fmtK(p.totalDisbursed),    sub: 'histórico acumulado',                      icon: '🏦', accent: '#2563EB', bg: '#EFF6FF' },
                { label: 'Préstamos morosos', value: String(p.delinquentCount),  sub: fmtK(p.overdueAmountTotal) + ' vencido',    icon: '⚠️', accent: '#F97316', bg: '#FFF7ED' },
                { label: 'Pagados/cerrados',  value: String(p.paidOffCount),     sub: 'completados',                              icon: '✅', accent: '#0284C7', bg: '#F0F9FF' },
              ].map(({ label, value, sub, icon, accent, bg }) => (
                <div key={label} className="relative rounded-2xl border overflow-hidden"
                  style={{ background: bg, borderColor: accent + '33', boxShadow: '0 2px 10px rgba(0,0,0,.05)' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: accent }} />
                  <div className="pl-5 pr-4 py-4">
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 leading-tight">{label}</p>
                      <span className="text-xl flex-shrink-0">{icon}</span>
                    </div>
                    <p className="text-2xl font-black leading-none mb-1" style={{ color: accent }}>{value}</p>
                    <p className="text-xs text-slate-500">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Operational row: due today + collected + pending */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
              {[
                { label: 'Cuotas vencen hoy', value: fmtK(p.dueTodayAmount), sub: `${p.dueTodayCount} cuota${p.dueTodayCount !== 1 ? 's' : ''}`, bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', emoji: '📅' },
                { label: 'Cobrado este mes',  value: fmtK(p.collectedMonth),  sub: 'pagos registrados',                                             bg: '#ECFDF5', border: '#6EE7B7', color: '#064E3B', emoji: '💸' },
                { label: 'En evaluación',     value: String(p.pendingApprovalCount),         sub: 'solicitudes pendientes',                        bg: '#EFF6FF', border: '#BFDBFE', color: '#1E40AF', emoji: '📋' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-3 sm:p-5 border"
                  style={{ background: s.bg, borderColor: s.border, boxShadow: '0 2px 10px rgba(0,0,0,.05)' }}>
                  <div className="flex flex-col items-center gap-0.5 sm:hidden">
                    <span className="text-xl leading-none mb-0.5">{s.emoji}</span>
                    <div className="text-lg font-black leading-none text-center" style={{ color: s.color }}>{s.value}</div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-center mt-0.5" style={{ color: s.color }}>{s.label}</p>
                  </div>
                  <div className="hidden sm:block">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{s.emoji}</span>
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
                    </div>
                    <p className="font-display text-2xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs mt-1" style={{ color: s.color, opacity: 0.7 }}>{s.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── Payment status section ── */}
      {clients.length > 0 && (() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        type PayStatus = 'overdue' | 'due-today' | 'upcoming' | 'active' | 'no-date' | 'paid'

        function getPayStatus(c: ClientRow): PayStatus {
          const startDateStr = c.params?.startDate
          if (!startDateStr) return 'no-date'
          if (c.loanStatus === 'denied') return 'no-date'

          // If the client already paid this month, skip all date-based checks
          if (isPaidThisMonth(c)) return 'paid'

          const start = new Date(startDateStr + 'T12:00:00')
          const totalMonths: number = c.result?.totalMonths ?? (c.params?.termYears ?? 0) * 12
          const end = new Date(start)
          end.setMonth(end.getMonth() + totalMonths)

          if (today > end) return 'overdue'

          const payDay = start.getDate()
          const thisMonth = new Date(today.getFullYear(), today.getMonth(), payDay)
          // Clamp to last day of month if payDay overflows
          const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
          const clampedDay = Math.min(payDay, lastDay)
          const thisMonthPayment = new Date(today.getFullYear(), today.getMonth(), clampedDay)

          if (thisMonthPayment.getTime() === today.getTime()) return 'due-today'
          if (thisMonthPayment < today) return 'overdue'
          const sevenDays = new Date(today); sevenDays.setDate(today.getDate() + 7)
          if (thisMonthPayment <= sevenDays) return 'upcoming'
          return 'active'
        }

        const withDate = clients.filter(c => c.params?.startDate && c.loanStatus !== 'denied')
        if (withDate.length === 0) return null

        const overdue      = withDate.filter(c => getPayStatus(c) === 'overdue')
        const dueToday     = withDate.filter(c => getPayStatus(c) === 'due-today')
        const upcoming     = withDate.filter(c => getPayStatus(c) === 'upcoming')
        const paidThisMonth = withDate.filter(c => getPayStatus(c) === 'paid')
        const alertClients = [...dueToday, ...overdue, ...upcoming, ...paidThisMonth]

        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              {SECTION_BAR}
              <h3 className="font-display text-base" style={{ color: '#0D2B5E' }}>Estado de vencimientos</h3>
            </div>

            {/* 4 KPI pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Vencidos / atrasados', count: overdue.length,       emoji: '🔴', bg: '#FFF1F2', border: '#FECDD3', color: '#881337' },
                { label: 'Cuota hoy',            count: dueToday.length,      emoji: '🟡', bg: '#FFFBEB', border: '#FDE68A', color: '#92400E' },
                { label: 'Próximos 7 días',      count: upcoming.length,      emoji: '🟢', bg: '#F0FDF4', border: '#86EFAC', color: '#14532D' },
                { label: 'Pagado este mes',       count: paidThisMonth.length, emoji: '✅', bg: '#F0FDF4', border: '#6EE7B7', color: '#065F46' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-3 sm:p-4 border text-center sm:text-left"
                  style={{ background: s.bg, borderColor: s.border }}>
                  <div className="sm:flex sm:items-center sm:gap-3">
                    <span className="text-2xl sm:text-3xl leading-none">{s.emoji}</span>
                    <div>
                      <p className="font-black text-2xl sm:text-3xl leading-none mt-1 sm:mt-0"
                        style={{ color: s.color }}>{s.count}</p>
                      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider mt-0.5"
                        style={{ color: s.color }}>{s.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Alert client list */}
            {alertClients.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
                <div className="px-5 py-3 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Clientes con cuotas próximas o vencidas
                </div>
                <div className="divide-y divide-slate-100">
                  {alertClients.map(c => {
                    const status = getPayStatus(c)
                    const startD  = new Date(c.params.startDate + 'T12:00:00')
                    const payDay  = startD.getDate()
                    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
                    const clampedDay = Math.min(payDay, lastDay)
                    const payDate = new Date(today.getFullYear(), today.getMonth(), clampedDay)
                    const payDateStr = payDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

                    const pill = status === 'paid'
                      ? { label: 'Pagado',  bg: '#F0FDF4', color: '#065F46', border: '#6EE7B7' }
                      : status === 'overdue'
                      ? { label: 'Vencido', bg: '#FFF1F2', color: '#881337', border: '#FECDD3' }
                      : status === 'due-today'
                      ? { label: 'Hoy',     bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' }
                      : { label: '7 días',  bg: '#F0FDF4', color: '#14532D', border: '#86EFAC' }

                    return (
                      <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg,#1565C0,#0D2B5E)' }}>
                          {c.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: '#0D2B5E' }}>{c.name}</p>
                          <p className="text-xs text-slate-400">Cuota: {fmtLoan(c.result?.monthlyPayment ?? 0, c.params.currency)} · vence {payDateStr}</p>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                          style={{ background: pill.bg, color: pill.color, border: `1px solid ${pill.border}` }}>
                          {pill.label}
                        </span>
                        {onViewProfile && (
                          <button onClick={() => onViewProfile(c.id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:bg-slate-100 text-slate-500 flex-shrink-0">
                            Ver →
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Charts ── */}
      {stats && (stats.byProfile?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Bar chart — by risk profile */}
          <div className="rounded-2xl p-6 bg-white border border-slate-200"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
            <div className="flex items-center gap-2.5 mb-5">
              {SECTION_BAR}
              <h3 className="font-display text-base" style={{ color: '#0D2B5E' }}>
                Préstamos por perfil de riesgo
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.byProfile} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4fa" vertical={false} />
                <XAxis dataKey="profile" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v: any) => [v, 'Cantidad']}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {stats.byProfile.map((e, i) => (
                    <Cell key={i} fill={PROFILE_COLOR[e.profile] ?? '#1565C0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex gap-3 flex-wrap mt-3">
              {stats.byProfile.map(p => (
                <div key={p.profile} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-2.5 h-2.5 rounded-full"
                    style={{ background: PROFILE_COLOR[p.profile] ?? '#1565C0' }} />
                  {p.profile}: <strong style={{ color: '#0D2B5E' }}>{p.count}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Pie chart — by currency */}
          <div className="rounded-2xl p-6 bg-white border border-slate-200"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
            <div className="flex items-center gap-2.5 mb-5">
              {SECTION_BAR}
              <h3 className="font-display text-base" style={{ color: '#0D2B5E' }}>
                Distribución por moneda
              </h3>
            </div>
            {stats.byCurrency.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={stats.byCurrency} dataKey="count" nameKey="currency"
                    cx="50%" cy="50%" outerRadius={80}
                    label={({ currency, percent }) =>
                      `${currency} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {stats.byCurrency.map((_, i) => (
                      <Cell key={i} fill={CURRENCY_COLORS[i % CURRENCY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                Sin datos todavía
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Search bar above client table ── */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none select-none">🔍</span>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente por nombre o email..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white"
          style={{ color: '#374151', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }} />
      </div>

      {/* ── Client Table ── */}
      <div className="rounded-2xl bg-white border border-slate-200"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>

        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center gap-2.5">
          {SECTION_BAR}
          <h3 className="font-display text-base" style={{ color: '#0D2B5E' }}>
            Todos los clientes
          </h3>
          <span className="text-xs text-slate-400 ml-1">({filtered.length})</span>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-14 text-slate-400">
            <p className="text-4xl mb-3">{search ? '🔍' : '👥'}</p>
            <p className="text-sm">
              {search ? 'Sin resultados para esa búsqueda' : 'No hay clientes en la base de datos'}
            </p>
            {!search && (
              <p className="text-xs mt-1">
                Guardá clientes desde la pestaña <strong>👥 Clientes</strong>
              </p>
            )}
          </div>
        )}

        {/* Client rows */}
        <div className="divide-y divide-slate-100">
          {filtered.map(c => {
            const profile = RISK_PROFILES.find(p => p.label === c.params?.profile)
            const cur: Currency = c.params?.currency ?? 'USD'
            const isExpanded = expandDoc === c.id

            const statusKey = (c.loanStatus ?? 'pending') as keyof typeof STATUS_CFG
            const statusCfg = STATUS_CFG[statusKey] ?? STATUS_CFG.pending

            return (
              <div key={c.id} className="px-3 py-3 sm:px-6 sm:py-4">

                {/* Top row: avatar + info */}
                <div className="flex items-start gap-3 mb-2.5">
                  {/* Avatar */}
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#1565C0,#0D2B5E)' }}>
                    {c.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <p className="text-sm font-bold" style={{ color: '#0D2B5E' }}>{c.name}</p>
                      {profile && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: profile.colorBg, color: profile.colorText }}>
                          {profile.emoji} {profile.label}
                        </span>
                      )}
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: statusCfg.bg, color: statusCfg.color }}>
                        {statusCfg.emoji} {statusCfg.label}
                      </span>
                      {isPaidThisMonth(c) && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}>
                          ✅ Pagado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      <strong>{fmtLoan(c.params?.amount ?? 0, cur)}</strong>
                      {' · '}{c.params?.termYears} años
                      {c.result && <> · <strong>{fmtLoan(c.result.monthlyPayment, cur)}/mes</strong></>}
                    </p>
                    {c.savedAt && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(c.savedAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {c.email && <span className="ml-1.5 hidden sm:inline">{c.email}</span>}
                        {c.documents?.length > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-semibold"
                            style={{ background: '#e8eef7', color: '#1565C0' }}>
                            📎 {c.documents.length}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Perfil button */}
                    <button
                      onClick={() => onViewProfile?.(c.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)', color: '#fff' }}>
                      👤 Perfil
                    </button>
                    {/* Docs toggle */}
                    <button
                      onClick={() => setExpandDoc(isExpanded ? null : c.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: isExpanded ? '#0D2B5E' : '#e8eef7',
                               color: isExpanded ? '#fff' : '#1565C0' }}>
                      📎 Docs {c.documents?.length > 0 && `(${c.documents.length})`}
                    </button>
                    <button onClick={() => handleDelete(c.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                      🗑️
                    </button>
                  </div>

                {/* Documents panel (collapsible) */}
                {isExpanded && (
                  <div className="mt-3 ml-0 sm:ml-14 rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Documentos del cliente
                    </p>

                    {/* Existing docs */}
                    {c.documents?.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {c.documents.map(doc => (
                          <a key={doc.id}
                            href={doc.url.startsWith('data:')
                              ? doc.url
                              : `/api/clients/${c.id}/documents/${doc.id}/presign`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all"
                            style={{ color: '#0D2B5E' }}>
                            {docIcon(doc.type)} {doc.name}
                            <span className="text-slate-400 font-normal">
                              ({(doc.size / 1024).toFixed(0)} KB)
                            </span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mb-3">Sin documentos adjuntos.</p>
                    )}

                    {/* Upload new doc */}
                    <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border-2 border-dashed ${uploading === c.id ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 hover:text-blue-600'}`}
                      style={{ borderColor: '#c5d5ea', color: '#64748b' }}>
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploading === c.id}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xlsx,.xls"
                        ref={el => { fileInputRefs.current[c.id] = el }}
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) handleUpload(c.id, f)
                          e.target.value = ''
                        }}
                      />
                      {uploading === c.id ? '⏳ Subiendo...' : '+ Subir documento'}
                    </label>
                    <p className="text-xs text-slate-400 mt-2">
                      PDF, Word, Excel, imágenes · Máx. 10 MB
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
