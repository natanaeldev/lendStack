'use client'
import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/loan'
import { LOAN_STATUS_CONFIG, type LoanStatus } from '@/lib/loanDomain'
import type { Currency } from '@/lib/loan'
import CreatePrestamoButton from '@/components/prestamos/CreatePrestamoButton'
import CreatePrestamoFlow from '@/components/prestamos/CreatePrestamoFlow'

interface LoanRow {
  _id: string
  clientId: string
  borrowerName: string
  borrowerPhone: string
  status: LoanStatus
  loanType: string
  currency: Currency
  amount: number
  scheduledPayment: number
  remainingBalance: number
  paidTotal: number
  disbursedAt?: string
  createdAt: string
  daysPastDue?: number
  overdueAmount?: number
  flatRate?: number
  carritoTerm?: number
  carritoPayments?: number
  numPayments?: number
  frequency?: string
}

interface Props {
  onViewLoan: (loanId: string) => void
  createRequestKey?: number
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return 'No disponible' }
}

function StatusBadge({ status }: { status: LoanStatus }) {
  const cfg = LOAN_STATUS_CONFIG[status] ?? LOAN_STATUS_CONFIG.application_submitted
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border flex-shrink-0"
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold font-mono" style={{ color: color ?? '#1E293B' }}>{value}</p>
    </div>
  )
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  amortized: 'Amortizado',
  weekly: 'Semanal',
  carrito: 'Interés plano',
  flat: 'Interés plano',
  flat_rate: 'Interés plano',
  interes_plano: 'Interés plano',
}

function loanTypeLabel(loan: LoanRow) {
  const rawType = loan.loanType
  if (!rawType) return 'No disponible'

  const normalized = rawType.toLowerCase().trim().replace(/[\s-]+/g, '_')
  const hasFlatSignals = [loan.flatRate, loan.carritoTerm, loan.carritoPayments, loan.numPayments, loan.frequency]
    .some((value) => value !== undefined && value !== null && value !== '')

  if (normalized === 'amortized' && hasFlatSignals) return 'Interés plano'
  return LOAN_TYPE_LABELS[normalized] ?? rawType
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'application_submitted', label: 'Enviada' },
  { value: 'under_review', label: 'En revisión' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'disbursed', label: 'Desembolsado' },
  { value: 'active', label: 'Activo' },
  { value: 'delinquent', label: 'Moroso' },
  { value: 'paid_off', label: 'Pagado' },
  { value: 'denied', label: 'Denegado' },
  { value: 'defaulted', label: 'Default' },
  { value: 'cancelled', label: 'Cancelado' },
]

export default function LoansPanel({ onViewLoan, createRequestKey = 0 }: Props) {
  const [loans, setLoans] = useState<LoanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError('')
    const url = statusFilter ? `/api/loans?status=${statusFilter}` : '/api/loans'
    fetch(url)
      .then(r => r.json())
      .then(d => setLoans(d.loans ?? []))
      .catch(() => setError('Error al cargar préstamos'))
      .finally(() => setLoading(false))
  }, [statusFilter, refreshNonce])

  useEffect(() => {
    if (createRequestKey > 0) setCreateOpen(true)
  }, [createRequestKey])

  const filtered = useMemo(() => {
    if (!search.trim()) return loans
    const q = search.toLowerCase()
    return loans.filter(l =>
      l.borrowerName.toLowerCase().includes(q) ||
      l._id.includes(q) ||
      l.borrowerPhone.includes(q),
    )
  }, [loans, search])

  const metrics = useMemo(() => {
    const active = loans.filter(l => ['active', 'delinquent'].includes(l.status))
    const delinquent = loans.filter(l => l.status === 'delinquent')
    return {
      totalActive: active.length,
      activePortfolio: active.reduce((sum, loan) => sum + loan.remainingBalance, 0),
      delinquentCount: delinquent.length,
      overdueAmount: delinquent.reduce((sum, loan) => sum + (loan.overdueAmount ?? 0), 0),
      currency: (loans[0]?.currency ?? 'DOP') as Currency,
    }
  }, [loans])

  const handleCreated = (loanId: string) => {
    setRefreshNonce((value) => value + 1)
    onViewLoan(loanId)
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Préstamos</h2>
            <p className="text-xs sm:text-sm text-slate-500">Ciclo de vida operacional de la cartera</p>
          </div>
          <CreatePrestamoButton onClick={() => setCreateOpen(true)} />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5" style={{ boxShadow: '0 8px 24px rgba(15,23,42,.05)' }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Nuevo flujo</p>
              <h3 className="mt-1 text-base font-bold text-slate-800">Crear préstamo sin pasar por Clientes</h3>
              <p className="mt-1 text-sm text-slate-500">Elegí tipo, cliente y condiciones sin salir de la vista de Préstamos.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-500 sm:min-w-[320px]">
              <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">1. Tipo</div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">2. Cliente</div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">3. Guardar</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          {[
            { label: 'Cartera activa', value: formatCurrency(metrics.activePortfolio, metrics.currency), sub: `${metrics.totalActive} préstamos`, dot: '#10B981', bg: '#ECFDF5' },
            { label: 'Morosos', value: String(metrics.delinquentCount), sub: 'con atraso', dot: '#F97316', bg: '#FFF7ED' },
            { label: 'Monto vencido', value: formatCurrency(metrics.overdueAmount, metrics.currency), sub: 'en morosos', dot: '#DC2626', bg: '#FFF1F2' },
            { label: 'Total préstamos', value: String(loans.length), sub: 'en el sistema', dot: '#3B82F6', bg: '#EFF6FF' },
          ].map(({ label, value, sub, dot, bg }) => (
            <div key={label} className="rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-100" style={{ background: bg, boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
              <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 leading-tight">{label}</span>
              </div>
              <p className="text-base sm:text-xl font-bold text-slate-800 truncate">{value}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, ID o teléfono"
            className="w-full sm:flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
          >
            {STATUS_FILTER_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">Cargando...</p>
            </div>
          </div>
        ) : error ? (
          <p className="text-red-600 text-sm px-1">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 rounded-3xl border border-dashed border-slate-200 bg-white">
            <p className="text-4xl mb-3">—</p>
            <p className="font-semibold text-slate-600">No se encontraron préstamos</p>
            <p className="text-sm">Probá otro filtro o creá un préstamo nuevo sin salir de esta vista.</p>
            <div className="mt-4 flex justify-center">
              <CreatePrestamoButton onClick={() => setCreateOpen(true)} />
            </div>
          </div>
        ) : (
          <>
            <div className="sm:hidden space-y-3">
              {filtered.map(loan => (
                <button
                  key={loan._id}
                  onClick={() => onViewLoan(loan._id)}
                  className="w-full text-left rounded-2xl border p-4 transition-colors active:bg-slate-50 cursor-pointer"
                  style={{
                    background: loan.status === 'delinquent' ? '#FFFBF5' : '#FFFFFF',
                    borderColor: loan.status === 'delinquent' ? '#FDBA74' : '#E2E8F0',
                    boxShadow: '0 1px 6px rgba(0,0,0,.04)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 leading-tight">{loan.borrowerName}</p>
                      {loan.borrowerPhone && <p className="text-xs text-slate-400 mt-0.5">{loan.borrowerPhone}</p>}
                    </div>
                    <StatusBadge status={loan.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <MiniStat label="Capital" value={formatCurrency(loan.amount, loan.currency)} />
                    <MiniStat label="Saldo" value={formatCurrency(loan.remainingBalance, loan.currency)} color={loan.status === 'delinquent' ? '#EA580C' : undefined} />
                    <MiniStat label="Cuota" value={formatCurrency(loan.scheduledPayment, loan.currency)} />
                    <MiniStat label="Tipo" value={loanTypeLabel(loan)} />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
                    <p className="text-xs text-slate-400">{loan.disbursedAt ? `Desembolso: ${fmtDate(loan.disbursedAt)}` : 'Sin desembolso'}</p>
                    <span className="text-xs font-bold text-blue-600">Ver</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="hidden sm:block rounded-2xl bg-white border border-slate-200 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100" style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
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
                      <tr key={loan._id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer" style={loan.status === 'delinquent' ? { background: '#FFFBF5' } : {}} onClick={() => onViewLoan(loan._id)}>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-800">{loan.borrowerName}</p>
                          {loan.borrowerPhone && <p className="text-xs text-slate-400">{loan.borrowerPhone}</p>}
                        </td>
                        <td className="px-3 py-3"><StatusBadge status={loan.status} /></td>
                        <td className="px-3 py-3 text-slate-600">{loanTypeLabel(loan)}</td>
                        <td className="px-3 py-3 text-right font-mono text-slate-700">{formatCurrency(loan.amount, loan.currency)}</td>
                        <td className="px-3 py-3 text-right font-mono" style={{ color: loan.status === 'delinquent' ? '#EA580C' : '#374151' }}>{formatCurrency(loan.remainingBalance, loan.currency)}</td>
                        <td className="px-3 py-3 text-right font-mono text-slate-600">{formatCurrency(loan.scheduledPayment, loan.currency)}</td>
                        <td className="px-3 py-3 text-slate-500">{fmtDate(loan.disbursedAt)}</td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={e => { e.stopPropagation(); onViewLoan(loan._id) }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
                            Ver
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

            <p className="sm:hidden text-xs text-slate-400 px-1">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </p>
          </>
        )}
      </div>

      <CreatePrestamoFlow open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </div>
  )
}

