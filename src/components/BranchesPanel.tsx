'use client'
import { useState, useEffect, useMemo } from 'react'
import { formatCurrency, Currency, Branch } from '@/lib/loan'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchDoc {
  id: string; name: string; type: Branch
}

interface BranchClient {
  id: string; name: string; email: string; savedAt: string
  branch: Branch | null; branchId: string | null; branchName: string | null
  loanStatus?: string
  params: { amount: number; termYears: number; currency: Currency; profile: string; startDate?: string }
  result: { monthlyPayment: number; totalInterest: number; totalMonths?: number }
  payments?: { id: string; date: string; amount: number }[]
}

interface BranchStats {
  totalClients:      number
  totalAmount:       number
  totalInterest:     number
  approvedCount:     number
  pendingCount:      number
  avgMonthlyPayment: number
  byCurrency:        { currency: string; avgMonthlyPayment: number }[]
  recoveryByCurrency:{ currency: string; totalAmount: number; totalRecovered: number; percentage: number }[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<Branch, { label: string; emoji: string; bg: string; color: string; border: string; accent: string }> = {
  sede:  { label: 'Sede',  emoji: '🏢', bg: '#EFF6FF', color: '#1565C0', border: '#BFDBFE', accent: '#1565C0' },
  rutas: { label: 'Rutas', emoji: '🚗', bg: '#F0FDF4', color: '#15803D', border: '#86EFAC', accent: '#15803D' },
}

const STATUS_CFG: Record<string, { label: string; emoji: string; bg: string; color: string; border: string }> = {
  pending:  { label: 'Pendiente', emoji: '⏳', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  approved: { label: 'Aprobado',  emoji: '✅', bg: '#F0FDF4', color: '#14532D', border: '#86EFAC' },
  denied:   { label: 'Denegado',  emoji: '❌', bg: '#FFF1F2', color: '#881337', border: '#FECDD3' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function fmtK(n: number) {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(0)}K`
    : `$${Math.round(n).toLocaleString('es-AR')}`
}

function computeStats(clients: BranchClient[]): BranchStats {
  const totalClients  = clients.length
  const totalAmount   = clients.reduce((s, c) => s + (c.params?.amount ?? 0), 0)
  const totalInterest = clients.reduce((s, c) => s + (c.result?.totalInterest ?? 0), 0)
  const approvedCount = clients.filter(c => c.loanStatus === 'approved').length
  const pendingCount  = clients.filter(c => !c.loanStatus || c.loanStatus === 'pending').length

  const currencySet = new Set(clients.map(c => c.params?.currency).filter(Boolean))
  const currencies = Array.from(currencySet) as Currency[]
  const byCurrency = currencies.map(cur => {
    const cc = clients.filter(c => c.params?.currency === cur && (c.result?.monthlyPayment ?? 0) > 0)
    const avg = cc.length > 0 ? cc.reduce((s, c) => s + c.result.monthlyPayment, 0) / cc.length : 0
    return { currency: cur, avgMonthlyPayment: avg }
  }).sort((a, b) => a.currency.localeCompare(b.currency))

  const allPayments = clients.map(c => c.result?.monthlyPayment ?? 0).filter(v => v > 0)
  const avgMonthlyPayment = allPayments.length > 0
    ? allPayments.reduce((s, v) => s + v, 0) / allPayments.length
    : 0

  // Recovery per currency: sum of all recorded payments vs total capital lent
  const recoveryByCurrency = currencies.map(cur => {
    const cc             = clients.filter(c => c.params?.currency === cur)
    const totalAmt       = cc.reduce((s, c) => s + (c.params?.amount ?? 0), 0)
    const totalRecovered = cc.reduce((s, c) =>
      s + (c.payments ?? []).reduce((ps, p) => ps + (p.amount ?? 0), 0), 0)
    const percentage = totalAmt > 0 ? Math.round((totalRecovered / totalAmt) * 100) : 0
    return { currency: cur, totalAmount: totalAmt, totalRecovered, percentage }
  }).sort((a, b) => a.currency.localeCompare(b.currency))

  return { totalClients, totalAmount, totalInterest, approvedCount, pendingCount, avgMonthlyPayment, byCurrency, recoveryByCurrency }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiMini({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4 flex flex-col gap-1"
      style={{ boxShadow: '0 1px 8px rgba(0,0,0,.05)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <span className="text-base">{icon}</span>
      </div>
      <p className="text-xl font-black" style={{ color: '#0D2B5E' }}>{value}</p>
    </div>
  )
}

// ─── Branch Detail View ───────────────────────────────────────────────────────

function BranchDetail({
  branch, clients, onBack, onViewProfile,
}: {
  branch: BranchDoc
  clients: BranchClient[]
  onBack: () => void
  onViewProfile?: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const cfg   = TYPE_CFG[branch.type]
  const stats = useMemo(() => computeStats(clients), [clients])

  const filtered = useMemo(() =>
    clients.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    ), [clients, search])

  const approvalRate = stats.totalClients > 0
    ? Math.round((stats.approvedCount / stats.totalClients) * 100)
    : 0

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors hover:bg-slate-100"
          style={{ color: '#64748b' }}>
          ← Volver
        </button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{cfg.emoji}</span>
          <h2 className="text-xl font-black" style={{ color: '#0D2B5E' }}>{branch.name}</h2>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiMini label="Clientes"      value={String(stats.totalClients)}  icon="👥" />
        {/* Cartera total — per currency */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 flex flex-col gap-1"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,.05)' }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cartera total</p>
            <span className="text-base">💼</span>
          </div>
          {stats.recoveryByCurrency.length === 0 ? (
            <p className="text-xl font-black" style={{ color: '#0D2B5E' }}>—</p>
          ) : (
            <div className="space-y-1 mt-0.5">
              {stats.recoveryByCurrency.map(r => (
                <div key={r.currency} className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{ background: '#EEF4FF', color: '#1565C0' }}>
                    {r.currency}
                  </span>
                  <span className="text-lg font-black tabular-nums leading-none" style={{ color: '#0D2B5E' }}>
                    {fmtK(r.totalAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <KpiMini label="Aprobación"    value={`${approvalRate}%`}          icon="✅" />
        <KpiMini label="Interés total" value={fmtK(stats.totalInterest)}   icon="💰" />
      </div>

      {/* Cuota promedio por moneda */}
      {stats.byCurrency.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 p-4"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,.05)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
            💳 Cuota promedio mensual por moneda
          </p>
          <div className="flex flex-wrap gap-4">
            {stats.byCurrency.map(c => (
              <div key={c.currency} className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{ background: '#EEF4FF', color: '#1565C0' }}>
                  {c.currency}
                </span>
                <span className="text-base font-black" style={{ color: '#0D2B5E' }}>
                  ${Math.round(c.avgMonthlyPayment).toLocaleString('es-AR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Capital recovery by currency */}
      {stats.recoveryByCurrency.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 p-4"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,.05)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              💰 Recuperación de cartera
            </p>
            <p className="text-[10px] text-slate-400">capital cobrado vs. capital prestado</p>
          </div>
          <div className="space-y-3">
            {stats.recoveryByCurrency.map(r => (
              <div key={r.currency}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: '#EEF4FF', color: '#1565C0' }}>
                      {r.currency}
                    </span>
                    <span className="text-xs text-slate-500">
                      {fmtK(r.totalRecovered)} de {fmtK(r.totalAmount)}
                    </span>
                  </div>
                  <span className="text-sm font-black tabular-nums"
                    style={{ color: r.percentage >= 70 ? '#15803D' : r.percentage >= 40 ? '#92400E' : '#0D2B5E' }}>
                    {r.percentage}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
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

      {/* Client list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full" style={{ background: cfg.accent }} />
            <h3 className="font-bold text-sm" style={{ color: '#0D2B5E' }}>
              Clientes · {filtered.length}
            </h3>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-blue-400 w-48"
            style={{ background: '#f8fafc' }}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-sm">
              {search ? 'No hay clientes que coincidan con la búsqueda.' : 'Esta sucursal no tiene clientes aún.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => {
              const sCfg   = STATUS_CFG[c.loanStatus ?? 'pending']
              const cur    = c.params?.currency ?? 'USD'
              const fmt    = (v: number) => formatCurrency(v, cur)
              return (
                <div key={c.id} className="rounded-xl bg-white border border-slate-200 p-4 flex items-center gap-3"
                  style={{ boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#1565C0,#0D2B5E)' }}>
                    {initials(c.name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: '#0D2B5E' }}>{c.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <strong className="text-slate-600">{fmt(c.params?.amount ?? 0)}</strong>
                      {' · '}{c.params?.termYears ?? '?'} años
                      {' · '}<strong className="text-slate-600">{fmt(c.result?.monthlyPayment ?? 0)}/mes</strong>
                    </p>
                  </div>

                  {/* Status badge */}
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{ background: sCfg.bg, color: sCfg.color, border: `1px solid ${sCfg.border}` }}>
                    {sCfg.emoji} {sCfg.label}
                  </span>

                  {/* View button */}
                  {onViewProfile && (
                    <button onClick={() => onViewProfile(c.id)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:bg-slate-100 flex-shrink-0"
                      style={{ color: '#1565C0' }}>
                      Ver →
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Branch List Card ─────────────────────────────────────────────────────────

function BranchCard({
  branch, clients, onClick,
}: {
  branch: BranchDoc
  clients: BranchClient[]
  onClick: () => void
}) {
  const cfg   = TYPE_CFG[branch.type]
  const stats = useMemo(() => computeStats(clients), [clients])
  const approvalRate = stats.totalClients > 0
    ? Math.round((stats.approvedCount / stats.totalClients) * 100)
    : 0

  return (
    <button onClick={onClick}
      className="text-left rounded-2xl bg-white border border-slate-200 overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[.99] w-full"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,.06)', borderTop: `3px solid ${cfg.accent}` }}>

      <div className="p-5">
        {/* Branch name + badge */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{cfg.emoji}</span>
            <h3 className="font-black text-base leading-tight" style={{ color: '#0D2B5E' }}>
              {branch.name}
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
            {cfg.label}
          </span>
        </div>

        {/* Stats */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">👥 Clientes</span>
            <span className="font-bold" style={{ color: '#0D2B5E' }}>{stats.totalClients}</span>
          </div>
          <div className="text-xs space-y-1">
            <span className="text-slate-500">💼 Cartera</span>
            {stats.recoveryByCurrency.length === 0 ? (
              <div className="flex items-center justify-between">
                <span /><span className="font-bold" style={{ color: '#0D2B5E' }}>—</span>
              </div>
            ) : stats.recoveryByCurrency.map(r => (
              <div key={r.currency} className="flex items-center justify-between gap-2">
                <span className="px-1.5 py-0.5 rounded font-semibold text-[10px]"
                  style={{ background: '#EEF4FF', color: '#1565C0' }}>
                  {r.currency}
                </span>
                <span className="font-bold" style={{ color: '#0D2B5E' }}>{fmtK(r.totalAmount)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">✅ Aprobación</span>
            <span className="font-bold" style={{ color: approvalRate >= 60 ? '#15803D' : '#92400E' }}>
              {approvalRate}%
            </span>
          </div>
          {stats.byCurrency.length > 0 && (
            <div className="flex items-start justify-between text-xs gap-2">
              <span className="text-slate-500 flex-shrink-0">💳 Cuota prom.</span>
              <div className="flex flex-col items-end gap-0.5">
                {stats.byCurrency.map(c => (
                  <span key={c.currency} className="font-bold" style={{ color: '#0D2B5E' }}>
                    {c.currency} ${Math.round(c.avgMonthlyPayment).toLocaleString('es-AR')}
                  </span>
                ))}
              </div>
            </div>
          )}
          {stats.recoveryByCurrency.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-xs text-slate-500">💰 Recuperación</span>
              {stats.recoveryByCurrency.map(r => (
                <div key={r.currency}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] text-slate-400">{r.currency}</span>
                    <span className="text-[11px] font-bold"
                      style={{ color: r.percentage >= 70 ? '#15803D' : r.percentage >= 40 ? '#92400E' : '#0D2B5E' }}>
                      {r.percentage}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                    <div className="h-full rounded-full"
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
          )}
        </div>

        {/* CTA */}
        <div className="flex items-center justify-end">
          <span className="text-xs font-bold" style={{ color: cfg.color }}>
            Ver detalle →
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── Main BranchesPanel ───────────────────────────────────────────────────────

interface BranchesPanelProps {
  onViewProfile?: (id: string) => void
}

export default function BranchesPanel({ onViewProfile }: BranchesPanelProps) {
  const [branches,         setBranches]         = useState<BranchDoc[]>([])
  const [clients,          setClients]          = useState<BranchClient[]>([])
  const [loading,          setLoading]          = useState(true)
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/branches').then(r => r.ok ? r.json() : { branches: [] }),
      fetch('/api/clients').then(r => r.json()),
    ]).then(([b, c]) => {
      setBranches(b.branches ?? [])
      setClients(c.clients ?? [])
    }).finally(() => setLoading(false))
  }, [])

  const sedeGroup  = useMemo(() => branches.filter(b => b.type === 'sede'),  [branches])
  const rutasGroup = useMemo(() => branches.filter(b => b.type === 'rutas'), [branches])

  // Clients with no branch
  const unassigned = useMemo(() =>
    clients.filter(c => !c.branchId), [clients])

  function clientsForBranch(branchId: string) {
    return clients.filter(c => c.branchId === branchId)
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  const selectedBranch = branches.find(b => b.id === selectedBranchId)
  if (selectedBranch) {
    return (
      <BranchDetail
        branch={selectedBranch}
        clients={clientsForBranch(selectedBranch.id)}
        onBack={() => setSelectedBranchId(null)}
        onViewProfile={onViewProfile}
      />
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center text-slate-400">
          <p className="text-5xl mb-3 animate-pulse">🏢</p>
          <p className="text-sm">Cargando sucursales...</p>
        </div>
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (branches.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center"
        style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
        <p className="text-5xl mb-4">🏢</p>
        <h2 className="text-xl font-black mb-2" style={{ color: '#0D2B5E' }}>No hay sucursales aún</h2>
        <p className="text-slate-500 text-sm mb-6">
          Creá tu primera sucursal desde el panel de administración.
        </p>
        <a href="/admin/branches"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
          🏢 Gestionar sucursales →
        </a>
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-7">

      {/* ── Section header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#1565C0,#0D2B5E)' }} />
          <h2 className="font-black text-base" style={{ color: '#0D2B5E' }}>Sucursales</h2>
          <span className="text-xs text-slate-400">{branches.length} sucursal{branches.length !== 1 ? 'es' : ''}</span>
        </div>
        <a href="/admin/branches"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover:bg-slate-100"
          style={{ color: '#1565C0' }}>
          ⚙️ Gestionar
        </a>
      </div>

      {/* ── Sede group ── */}
      {sedeGroup.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: '#1565C0' }}>🏢 Sede</span>
            <span className="text-xs text-slate-400">({sedeGroup.length})</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sedeGroup.map(b => (
              <BranchCard
                key={b.id}
                branch={b}
                clients={clientsForBranch(b.id)}
                onClick={() => setSelectedBranchId(b.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Rutas group ── */}
      {rutasGroup.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: '#15803D' }}>🚗 Rutas</span>
            <span className="text-xs text-slate-400">({rutasGroup.length})</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rutasGroup.map(b => (
              <BranchCard
                key={b.id}
                branch={b}
                clients={clientsForBranch(b.id)}
                onClick={() => setSelectedBranchId(b.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Unassigned clients notice ── */}
      {unassigned.length > 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-4 flex items-center gap-3"
          style={{ background: '#f8fafc' }}>
          <span className="text-xl">⚠️</span>
          <p className="text-xs text-slate-500">
            <strong className="text-slate-700">{unassigned.length} cliente{unassigned.length !== 1 ? 's' : ''}</strong>
            {' '}sin sucursal asignada. Podés actualizarlos desde la pestaña{' '}
            <strong>Clientes</strong>.
          </p>
        </div>
      )}

    </div>
  )
}
