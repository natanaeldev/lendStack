'use client'
import { useState, useEffect, useMemo } from 'react'
import { formatCurrency }               from '@/lib/loan'
import { LOAN_STATUS_CONFIG, type LoanStatus } from '@/lib/loanDomain'
import type { Currency }                from '@/lib/loan'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoanRow {
  _id: string; clientId: string; borrowerName: string; borrowerPhone: string
  status: LoanStatus; loanType: string; currency: Currency
  amount: number; scheduledPayment: number; remainingBalance: number
  paidTotal: number; disbursedAt?: string; createdAt: string
  daysPastDue?: number; overdueAmount?: number
}

interface Props {
  onViewLoan: (loanId: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

function StatusBadge({ status }: { status: LoanStatus }) {
  const cfg = LOAN_STATUS_CONFIG[status] ?? LOAN_STATUS_CONFIG.application_submitted
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border"
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  amortized: 'Amortizado',
  weekly:    'Semanal',
  carrito:   'Carrito',
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '',                     label: 'Todos' },
  { value: 'application_submitted', label: 'Enviada' },
  { value: 'under_review',          label: 'En revisión' },
  { value: 'approved',              label: 'Aprobado' },
  { value: 'disbursed',             label: 'Desembolsado' },
  { value: 'active',                label: 'Activo' },
  { value: 'delinquent',            label: 'Moroso' },
  { value: 'paid_off',              label: 'Pagado' },
  { value: 'denied',                label: 'Denegado' },
  { value: 'defaulted',             label: 'Default' },
  { value: 'cancelled',             label: 'Cancelado' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoansPanel({ onViewLoan }: Props) {
  const [loans,     setLoans]     = useState<LoanRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [search,    setSearch]    = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    const url = statusFilter ? `/api/loans?status=${statusFilter}` : '/api/loans'
    fetch(url)
      .then(r => r.json())
      .then(d => setLoans(d.loans ?? []))
      .catch(() => setError('Error al cargar préstamos'))
      .finally(() => setLoading(false))
  }, [statusFilter])

  const filtered = useMemo(() => {
    if (!search.trim()) return loans
    const q = search.toLowerCase()
    return loans.filter(l =>
      l.borrowerName.toLowerCase().includes(q) ||
      l._id.includes(q) ||
      l.borrowerPhone.includes(q)
    )
  }, [loans, search])

  // ── Portfolio metrics ────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const active     = loans.filter(l => ['active','delinquent'].includes(l.status))
    const delinquent = loans.filter(l => l.status === 'delinquent')
    return {
      totalActive:     active.length,
      activePortfolio: active.reduce((s, l) => s + l.remainingBalance, 0),
      delinquentCount: delinquent.length,
      overdueAmount:   delinquent.reduce((s, l) => s + (l.overdueAmount ?? 0), 0),
      currency:        loans[0]?.currency ?? 'DOP' as Currency,
    }
  }, [loans])

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Préstamos</h2>
        <p className="text-sm text-slate-500">Ciclo de vida operacional de la cartera</p>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Cartera activa',
            value: formatCurrency(metrics.activePortfolio, metrics.currency),
            sub:   `${metrics.totalActive} préstamos`,
            dot:   '#10B981', bg: '#ECFDF5',
          },
          {
            label: 'Morosos',
            value: String(metrics.delinquentCount),
            sub:   'préstamos con atraso',
            dot:   '#F97316', bg: '#FFF7ED',
          },
          {
            label: 'Monto vencido',
            value: formatCurrency(metrics.overdueAmount, metrics.currency),
            sub:   'en préstamos morosos',
            dot:   '#DC2626', bg: '#FFF1F2',
          },
          {
            label: 'Total préstamos',
            value: String(loans.length),
            sub:   'en el sistema',
            dot:   '#3B82F6', bg: '#EFF6FF',
          },
        ].map(({ label, value, sub, dot, bg }) => (
          <div key={label} className="rounded-2xl p-4 border border-slate-100"
            style={{ background: bg, boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
            </div>
            <p className="text-xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-500">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, ID, teléfono…"
          className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white" />
        <select
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white">
          {STATUS_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm">Cargando…</p>
          </div>
        </div>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold text-slate-600">No se encontraron préstamos</p>
          <p className="text-sm">Prueba otro filtro o crea un nuevo préstamo desde el perfil de cliente</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
          style={{ boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100"
                  style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
                  <th className="px-5 py-3 text-left">Prestatario</th>
                  <th className="px-3 py-3 text-left">Estado</th>
                  <th className="px-3 py-3 text-left">Tipo</th>
                  <th className="px-3 py-3 text-right">Capital</th>
                  <th className="px-3 py-3 text-right">Saldo</th>
                  <th className="px-3 py-3 text-right">Cuota</th>
                  <th className="px-3 py-3 text-left">Desembolso</th>
                  <th className="px-3 py-3 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(loan => (
                  <tr key={loan._id}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                    style={loan.status === 'delinquent' ? { background: '#FFFBF5' } : {}}
                    onClick={() => onViewLoan(loan._id)}>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800">{loan.borrowerName}</p>
                      {loan.borrowerPhone && (
                        <p className="text-xs text-slate-400">{loan.borrowerPhone}</p>
                      )}
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={loan.status} /></td>
                    <td className="px-3 py-3 text-slate-600">{LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-700">
                      {formatCurrency(loan.amount, loan.currency)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono"
                      style={{ color: loan.status === 'delinquent' ? '#EA580C' : '#374151' }}>
                      {formatCurrency(loan.remainingBalance, loan.currency)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                      {formatCurrency(loan.scheduledPayment, loan.currency)}
                    </td>
                    <td className="px-3 py-3 text-slate-500">{fmtDate(loan.disbursedAt)}</td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={e => { e.stopPropagation(); onViewLoan(loan._id) }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
                        Ver →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
