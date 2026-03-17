'use client'
import { useState, useEffect, useCallback } from 'react'
import { formatCurrency }                   from '@/lib/loan'
import {
  LOAN_STATUS_CONFIG,
  COLLECTION_ACTION_LABELS,
  type LoanStatus,
  type CollectionActionType,
} from '@/lib/loanDomain'
import { showToast }                        from '@/components/Toast'
import { PaymentReceiptModal }              from '@/components/PaymentReceipt'
import type { ReceiptData }                 from '@/components/PaymentReceipt'
import type { Currency }                    from '@/lib/loan'
import ModificationsPanel                  from '@/components/restructure/ModificationsPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoanData {
  _id: string; status: LoanStatus; loanType: string
  currency: Currency; amount: number; scheduledPayment: number
  totalPayment: number; totalInterest: number
  termYears?: number; termWeeks?: number; totalMonths?: number; totalWeeks?: number
  paidTotal: number; paidPrincipal: number; paidInterest: number; remainingBalance: number
  annualRate?: number; monthlyRate?: number
  disbursedAt?: string; disbursedAmount?: number; disbursementNotes?: string
  daysPastDue?: number; overdueInstallmentsCount?: number; overdueAmount?: number
  notes?: string; createdAt: string
}
interface Borrower {
  _id: string; name: string; email: string; phone: string
  idType: string; idNumber: string; address: string; occupation: string
  monthlyIncome: string; collateral: string
}
interface Installment {
  _id: string; installmentNumber: number; dueDate: string; periodLabel?: string
  scheduledAmount: number; scheduledPrincipal: number; scheduledInterest: number
  paidAmount: number; remainingAmount: number; status: string
}
interface Payment {
  _id: string; date: string; amount: number
  appliedPrincipal: number; appliedInterest: number; notes?: string; registeredAt: string
}
interface CollectionAction {
  _id: string; date: string; actionType: CollectionActionType
  note?: string; createdAt: string; promisedPaymentDate?: string; promisedAmount?: number
}
interface DelinquencyInfo {
  daysPastDue: number; overdueInstallmentsCount: number
  overdueAmount: number; isDelinquent: boolean
}

interface Props {
  loanId:  string
  onBack:  () => void
  onViewBorrower?: (clientId: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white'

function fmtDate(iso?: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

function StatusBadge({ status }: { status: LoanStatus }) {
  const cfg = LOAN_STATUS_CONFIG[status] ?? LOAN_STATUS_CONFIG.application_submitted
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border flex-shrink-0"
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function InstallmentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pendiente', color: '#92400E', bg: '#FFFBEB' },
    partial: { label: 'Parcial',   color: '#1E40AF', bg: '#EFF6FF' },
    paid:    { label: 'Pagado',    color: '#14532D', bg: '#F0FDF4' },
    overdue: { label: 'Vencida',   color: '#881337', bg: '#FFF1F2' },
  }
  const cfg = map[status] ?? map.pending
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

function SectionCard({ title, emoji, children, action }: {
  title: string; emoji: string; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center gap-2"
        style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
        <span className="text-base">{emoji}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500 flex-1">{title}</span>
        {action}
      </div>
      <div className="px-4 sm:px-5 py-4">{children}</div>
    </div>
  )
}

// ─── Lifecycle Stepper ────────────────────────────────────────────────────────

const LIFECYCLE_STEPS: LoanStatus[] = [
  'application_submitted', 'under_review', 'approved', 'disbursed', 'active',
]

function LifecycleStepper({ current }: { current: LoanStatus }) {
  const terminalOk   = ['paid_off'].includes(current)
  const terminalBad  = ['denied', 'defaulted', 'cancelled'].includes(current)
  const isDelinquent = current === 'delinquent'

  const activeIdx = LIFECYCLE_STEPS.indexOf(
    isDelinquent ? 'active' : current as any,
  )

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1 -mx-1 px-1">
      {LIFECYCLE_STEPS.map((step, idx) => {
        const cfg    = LOAN_STATUS_CONFIG[step]
        const done   = terminalOk || (activeIdx >= 0 && idx < activeIdx)
        const now    = !terminalOk && !terminalBad && activeIdx === idx
        return (
          <div key={step} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1" style={{ minWidth: 64 }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
                style={{
                  background:  done || now ? cfg.dot  : '#E5E7EB',
                  borderColor: done || now ? cfg.dot  : '#D1D5DB',
                  color:       done || now ? '#fff'   : '#9CA3AF',
                }}>
                {done ? '✓' : idx + 1}
              </div>
              <span className="text-[9px] sm:text-[10px] font-semibold text-center leading-tight"
                style={{ color: done || now ? cfg.color : '#9CA3AF', maxWidth: 56 }}>
                {cfg.label}
              </span>
            </div>
            {idx < LIFECYCLE_STEPS.length - 1 && (
              <div className="h-0.5 w-6 sm:w-8 mx-0.5 rounded"
                style={{ background: done ? '#10B981' : '#E5E7EB' }} />
            )}
          </div>
        )
      })}
      {(terminalOk || terminalBad || isDelinquent) && (
        <>
          <div className="h-0.5 w-6 sm:w-8 mx-0.5 rounded" style={{ background: '#E5E7EB' }} />
          <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 64 }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2"
              style={{
                background:  terminalOk ? '#0284C7' : isDelinquent ? '#F97316' : '#B91C1C',
                borderColor: terminalOk ? '#0284C7' : isDelinquent ? '#F97316' : '#B91C1C',
                color: '#fff',
              }}>
              {terminalOk ? '✓' : '!'}
            </div>
            <span className="text-[9px] sm:text-[10px] font-semibold text-center leading-tight"
              style={{ color: terminalOk ? '#0284C7' : isDelinquent ? '#F97316' : '#B91C1C', maxWidth: 56 }}>
              {LOAN_STATUS_CONFIG[current]?.label ?? current}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Disburse Modal ───────────────────────────────────────────────────────────

function DisburseModal({
  loanId, amount, currency, onClose, onSuccess,
}: { loanId: string; amount: number; currency: Currency; onClose: () => void; onSuccess: () => void }) {
  const [disbAmt, setDisbAmt] = useState(amount.toFixed(2))
  const [notes,   setNotes]   = useState('')
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')

  async function submit() {
    setLoading(true); setErr('')
    try {
      const res = await fetch(`/api/loans/${loanId}/disburse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disbursedAmount: parseFloat(disbAmt), notes }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Error'); return }
      showToast('Préstamo desembolsado y activo', 'success')
      onSuccess()
    } catch { setErr('Error de red') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 pb-8 sm:pb-6">
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-5 sm:hidden" />
        <h3 className="text-lg font-bold text-slate-800 mb-4">Confirmar desembolso</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Monto desembolsado
            </label>
            <input type="number" value={disbAmt} onChange={e => setDisbAmt(e.target.value)}
              className={inputCls} min="0" step="0.01" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Notas (opcional)
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className={inputCls} rows={2} />
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 active:bg-slate-50">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
            {loading ? 'Procesando…' : 'Desembolsar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Pay Modal ────────────────────────────────────────────────────────────────

function PayModal({
  loanId, scheduledPayment, currency, remaining,
  installments, borrower, loanAmount, totalInstallments, profile, onClose, onSuccess,
}: {
  loanId: string; scheduledPayment: number; currency: Currency
  remaining: number; installments: Installment[]
  borrower?: Borrower | null
  loanAmount: number
  totalInstallments: number
  profile?: string
  onClose: () => void; onSuccess: () => void
}) {
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [amount,   setAmount]   = useState(scheduledPayment.toFixed(2))
  const [targetId, setTargetId] = useState('')
  const [notes,    setNotes]    = useState('')
  const [loading,     setLoading]     = useState(false)
  const [err,         setErr]         = useState('')
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)

  async function submit() {
    const amt = parseFloat(amount)
    if (!date || isNaN(amt) || amt <= 0) { setErr('Fecha y monto requeridos'); return }
    if (amt > remaining + 0.005) { setErr(`El monto supera el saldo pendiente (${remaining.toFixed(2)})`); return }
    setLoading(true); setErr('')
    try {
      const res = await fetch(`/api/loans/${loanId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date, amount: amt,
          targetInstallmentId: targetId || undefined,
          notes: notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Error'); return }
      setReceiptData({
        clientName:     borrower?.name ?? data.receipt?.customerName ?? 'Cliente',
        clientIdType:   borrower?.idType ?? '',
        clientId:       borrower?.idNumber ?? '',
        clientEmail:    borrower?.email ?? '',
        paymentId:      data.paymentId ?? '',
        date:           data.receipt?.date ?? date,
        amount:         amt,
        notes:          notes || undefined,
        currency,
        loanAmount,
        monthlyPayment: scheduledPayment,
        totalMonths:    totalInstallments,
        profile:        profile ?? '',
      })
      showToast('Pago registrado', 'success')
    } catch { setErr('Error de red') }
    finally { setLoading(false) }
  }

  const unpaidInstallments = installments.filter(i => i.remainingAmount > 0)

  if (receiptData) return (
    <PaymentReceiptModal
      data={receiptData}
      onClose={() => { setReceiptData(null); onSuccess() }}
      zIndex={60} />
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 pb-8 sm:pb-6 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-5 sm:hidden" />
        <h3 className="text-lg font-bold text-slate-800 mb-4">Registrar pago</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Monto</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className={inputCls} min="0" max={remaining} step="0.01" />
            <p className="text-xs text-slate-400 mt-1">Saldo pendiente: {formatCurrency(remaining, currency)}</p>
          </div>
          {unpaidInstallments.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Cuota (opcional — por defecto la más antigua)
              </label>
              <select value={targetId} onChange={e => setTargetId(e.target.value)} className={inputCls}>
                <option value="">Auto (más antigua primero)</option>
                {unpaidInstallments.map(i => (
                  <option key={i._id} value={i._id}>
                    {i.periodLabel ?? `#${i.installmentNumber}`} — {fmtDate(i.dueDate)} — {formatCurrency(i.remainingAmount, currency)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Notas</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="Opcional" />
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 active:bg-slate-50">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#2563EB,#1D4ED8)' }}>
            {loading ? 'Procesando…' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Collection Modal ─────────────────────────────────────────────────────────

function CollectionModal({
  loanId, onClose, onSuccess,
}: { loanId: string; onClose: () => void; onSuccess: () => void }) {
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10))
  const [type,        setType]        = useState<CollectionActionType>('call')
  const [note,        setNote]        = useState('')
  const [promised,    setPromised]    = useState('')
  const [promisedAmt, setPromisedAmt] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [err,         setErr]         = useState('')

  async function submit() {
    setLoading(true); setErr('')
    try {
      const res = await fetch(`/api/loans/${loanId}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date, actionType: type,
          note: note || undefined,
          promisedPaymentDate: promised || undefined,
          promisedAmount: promisedAmt ? parseFloat(promisedAmt) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Error'); return }
      showToast('Acción de cobranza registrada', 'success')
      onSuccess()
    } catch { setErr('Error de red') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 pb-8 sm:pb-6 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-5 sm:hidden" />
        <h3 className="text-lg font-bold text-slate-800 mb-4">Acción de cobranza</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Tipo de acción</label>
            <select value={type} onChange={e => setType(e.target.value as CollectionActionType)} className={inputCls}>
              {(Object.entries(COLLECTION_ACTION_LABELS) as [CollectionActionType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Nota</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} className={inputCls} rows={2} placeholder="Describe el contacto o acuerdo" />
          </div>
          {type === 'promise_to_pay' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Fecha promesa</label>
                <input type="date" value={promised} onChange={e => setPromised(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Monto prometido</label>
                <input type="number" value={promisedAmt} onChange={e => setPromisedAmt(e.target.value)}
                  className={inputCls} min="0" step="0.01" />
              </div>
            </div>
          )}
          {err && <p className="text-red-600 text-sm">{err}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 active:bg-slate-50">
            Cancelar
          </button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
            {loading ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LoanDetailPanel({ loanId, onBack, onViewBorrower }: Props) {
  const [loan,         setLoan]         = useState<LoanData | null>(null)
  const [borrower,     setBorrower]     = useState<Borrower | null>(null)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [payments,     setPayments]     = useState<Payment[]>([])
  const [collections,  setCollections]  = useState<CollectionAction[]>([])
  const [delinquency,  setDelinquency]  = useState<DelinquencyInfo | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')

  const [showDisburse,   setShowDisburse]   = useState(false)
  const [showPay,        setShowPay]        = useState(false)
  const [showCollection, setShowCollection] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [reversingPayId, setReversingPayId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/loans/${loanId}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error'); return }
      setLoan(data.loan)
      setBorrower(data.borrower)
      setInstallments(data.installments ?? [])
      setPayments(data.payments ?? [])
      setCollections(data.collections ?? [])
      setDelinquency(data.delinquency)
    } catch { setError('Error de red') }
    finally { setLoading(false) }
  }, [loanId])

  useEffect(() => { loadData() }, [loadData])

  async function updateStatus(newStatus: LoanStatus) {
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/loans/${loanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) { const d = await res.json(); showToast(d.error ?? 'Error', 'error'); return }
      showToast('Estado actualizado', 'success')
      loadData()
    } catch { showToast('Error de red', 'error') }
    finally { setUpdatingStatus(false) }
  }

  async function reversePayment(paymentId: string) {
    if (!confirm('¿Anular este pago? Esta acción revierte las cuotas afectadas.')) return
    setReversingPayId(paymentId)
    try {
      const res = await fetch(`/api/loans/${loanId}/payments/${paymentId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); showToast(d.error ?? 'Error al anular pago', 'error'); return }
      showToast('Pago anulado', 'success')
      loadData()
    } catch { showToast('Error de red', 'error') }
    finally { setReversingPayId(null) }
  }

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm">Cargando préstamo…</p>
      </div>
    </div>
  )
  if (error || !loan) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-red-600">{error || 'Préstamo no encontrado'}</p>
      <button onClick={onBack} className="px-4 py-2 text-sm rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200">
        Volver
      </button>
    </div>
  )

  const cur         = loan.currency
  const canDisburse = loan.status === 'approved'
  const canPay      = ['active', 'delinquent', 'disbursed'].includes(loan.status)
  const canCollect  = ['active', 'delinquent'].includes(loan.status)
  const progressPct = loan.totalPayment > 0 ? Math.min((loan.paidTotal / loan.totalPayment) * 100, 100) : 0
  const hasActions  = canDisburse || canPay || canCollect

  return (
    <>
      {/* ── MAIN SCROLL AREA ───────────────────────────────────────────────── */}
      <div className={`max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 ${hasActions ? 'pb-28 sm:pb-6' : ''}`}>

        {/* ── Header — mobile: stacked, desktop: row ──────────────────────── */}
        {/* Mobile */}
        <div className="sm:hidden">
          <button onClick={onBack}
            className="flex items-center gap-1 text-sm font-semibold text-slate-500 mb-3 -ml-1 active:opacity-70">
            ← Volver
          </button>
          <div className="flex items-start gap-2 mb-1">
            <h1 className="text-xl font-bold text-slate-800 flex-1 leading-tight">
              {borrower?.name ?? '—'}
            </h1>
            <StatusBadge status={loan.status} />
          </div>
          <p className="text-xs text-slate-500">
            Préstamo {loan._id.slice(0, 8)} · Creado {fmtDate(loan.createdAt)}
          </p>
        </div>

        {/* Desktop */}
        <div className="hidden sm:flex items-start gap-4">
          <button onClick={onBack}
            className="mt-1 p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0">
            ← Volver
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="break-words text-2xl font-bold text-slate-800">{borrower?.name ?? '—'}</h1>
              <StatusBadge status={loan.status} />
            </div>
            <p className="text-sm text-slate-500">
              Préstamo {loan._id.slice(0, 8)} · Creado {fmtDate(loan.createdAt)}
            </p>
          </div>
          {/* Desktop action buttons inline */}
          <div className="flex gap-2 flex-wrap justify-end">
            {canDisburse && (
              <button onClick={() => setShowDisburse(true)}
                className="px-4 py-2 text-sm font-bold text-white rounded-xl"
                style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
                Desembolsar
              </button>
            )}
            {canPay && (
              <button onClick={() => setShowPay(true)}
                className="px-4 py-2 text-sm font-bold text-white rounded-xl"
                style={{ background: 'linear-gradient(135deg,#2563EB,#1D4ED8)' }}>
                Registrar pago
              </button>
            )}
            {canCollect && (
              <button onClick={() => setShowCollection(true)}
                className="px-4 py-2 text-sm font-bold text-white rounded-xl"
                style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
                Cobranza
              </button>
            )}
            {canPay && (
              <button
                onClick={() => {
                  const el = document.getElementById('modifications-panel')
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="px-4 py-2 text-sm font-bold rounded-xl border-2 border-slate-300 text-slate-600 hover:bg-slate-50">
                🔀 Reestructurar
              </button>
            )}
          </div>
        </div>

        {/* ── Delinquency alert ──────────────────────────────────────────────── */}
        {delinquency?.isDelinquent && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: '#FFF7ED', border: '1px solid #FDBA74' }}>
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-bold" style={{ color: '#7C2D12' }}>
                Moroso — {delinquency.daysPastDue} días de atraso
              </p>
              <p className="text-xs" style={{ color: '#9A3412' }}>
                {delinquency.overdueInstallmentsCount} cuota(s) vencida(s) ·{' '}
                {formatCurrency(delinquency.overdueAmount, cur)} pendiente
              </p>
            </div>
          </div>
        )}

        {/* ── Lifecycle stepper ──────────────────────────────────────────────── */}
        <SectionCard title="Ciclo de vida" emoji="🔄"
          action={
            <select
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white"
              value={loan.status}
              onChange={e => { if (!updatingStatus) updateStatus(e.target.value as LoanStatus) }}
              disabled={updatingStatus}>
              {(Object.entries(LOAN_STATUS_CONFIG) as [LoanStatus, any][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          }>
          <LifecycleStepper current={loan.status} />
        </SectionCard>

        {/* ── Loan summary + progress ──────────────────────────────────────── */}
        <SectionCard title="Resumen del préstamo" emoji="💰">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Capital',      value: formatCurrency(loan.amount, cur) },
              { label: 'Cuota',        value: formatCurrency(loan.scheduledPayment, cur) },
              { label: 'Total a pagar',value: formatCurrency(loan.totalPayment, cur) },
              { label: 'Total interés',value: formatCurrency(loan.totalInterest, cur) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
                <p className="text-sm sm:text-base font-bold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Pagado: {formatCurrency(loan.paidTotal, cur)}</span>
              <span>Pendiente: {formatCurrency(loan.remainingBalance, cur)}</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg,#10B981,#059669)' }} />
            </div>
            <p className="text-right text-xs text-slate-400 mt-1">{progressPct.toFixed(1)}% completado</p>
          </div>
        </SectionCard>

        {/* ── 3-col: disbursement + borrower + delinquency ─────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <SectionCard title="Desembolso" emoji="🏦">
            {loan.disbursedAt ? (
              <div className="space-y-2 text-sm">
                <InfoLine label="Fecha" value={fmtDate(loan.disbursedAt)} />
                <InfoLine label="Monto" value={formatCurrency(loan.disbursedAmount ?? loan.amount, cur)} />
                {loan.disbursementNotes && <InfoLine label="Notas" value={loan.disbursementNotes} />}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Aún no desembolsado</p>
            )}
          </SectionCard>

          <SectionCard title="Prestatario" emoji="👤"
            action={
              onViewBorrower && borrower
                ? <button onClick={() => onViewBorrower(borrower._id)}
                    className="text-xs text-blue-600 font-semibold hover:underline">Ver perfil</button>
                : undefined
            }>
            {borrower ? (
              <div className="space-y-2 text-sm">
                <InfoLine label="Teléfono"    value={borrower.phone} />
                <InfoLine label="Documento"   value={`${borrower.idType} ${borrower.idNumber}`} />
                <InfoLine label="Ocupación"   value={borrower.occupation} />
                <InfoLine label="Ingresos/mes" value={borrower.monthlyIncome} />
              </div>
            ) : <p className="text-sm text-slate-400 italic">—</p>}
          </SectionCard>

          <SectionCard title="Morosidad" emoji="⚠️">
            {delinquency?.isDelinquent ? (
              <div className="space-y-2 text-sm">
                <InfoLine label="Días de atraso"  value={String(delinquency.daysPastDue)} />
                <InfoLine label="Cuotas vencidas" value={String(delinquency.overdueInstallmentsCount)} />
                <InfoLine label="Monto vencido"   value={formatCurrency(delinquency.overdueAmount, cur)} />
              </div>
            ) : (
              <p className="text-sm font-semibold" style={{ color: '#059669' }}>Al corriente ✓</p>
            )}
          </SectionCard>
        </div>

        {/* ── Installments ─────────────────────────────────────────────────── */}
        {installments.length > 0 && (
          <SectionCard title="Tabla de cuotas" emoji="📅">
            {/* Mobile: cards */}
            <div className="sm:hidden space-y-2">
              {installments.map(inst => (
                <div key={inst._id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{
                    background:  inst.status === 'overdue' ? '#FFF7ED' : inst.status === 'paid' ? '#F0FDF4' : '#F8FAFC',
                    border:      `1px solid ${inst.status === 'overdue' ? '#FDBA74' : '#E2E8F0'}`,
                  }}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-600">
                      {inst.periodLabel ?? `#${inst.installmentNumber}`}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">{fmtDate(inst.dueDate)}</p>
                    <p className="text-sm font-bold text-slate-800 font-mono">
                      {formatCurrency(inst.scheduledAmount, cur)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <InstallmentBadge status={inst.status} />
                    {inst.remainingAmount > 0 && (
                      <p className="text-xs font-mono text-slate-500 mt-1">
                        Pendiente: {formatCurrency(inst.remainingAmount, cur)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto -mx-5">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="px-5 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Vencimiento</th>
                    <th className="px-3 py-2 text-right">Programado</th>
                    <th className="px-3 py-2 text-right">Pagado</th>
                    <th className="px-3 py-2 text-right">Pendiente</th>
                    <th className="px-3 py-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map(inst => (
                    <tr key={inst._id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                      style={inst.status === 'overdue' ? { background: '#FFF7ED' } : {}}>
                      <td className="px-5 py-2.5 font-semibold text-slate-600">{inst.periodLabel ?? `#${inst.installmentNumber}`}</td>
                      <td className="px-3 py-2.5 text-slate-600">{fmtDate(inst.dueDate)}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(inst.scheduledAmount, cur)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-green-700">{formatCurrency(inst.paidAmount, cur)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-700">{formatCurrency(inst.remainingAmount, cur)}</td>
                      <td className="px-3 py-2.5 text-center"><InstallmentBadge status={inst.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* ── Payment history ────────────────────────────────────────────────── */}
        <SectionCard title="Historial de pagos" emoji="💳"
          action={
            canPay
              ? <button onClick={() => setShowPay(true)}
                  className="text-xs text-blue-600 font-semibold hover:underline">+ Registrar</button>
              : undefined
          }>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin pagos registrados</p>
          ) : (
            <>
              {/* Mobile: timeline cards */}
              <div className="sm:hidden space-y-2">
                {payments.map(p => (
                  <div key={p._id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                      <span className="text-xs">💳</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold font-mono text-green-700 text-sm">
                          {formatCurrency(p.amount, cur)}
                        </span>
                        <span className="text-xs text-slate-400">{fmtDate(p.date)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Capital: {formatCurrency(p.appliedPrincipal, cur)} · Interés: {formatCurrency(p.appliedInterest, cur)}
                      </p>
                      {p.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{p.notes}</p>}
                    </div>
                    <button
                      onClick={() => reversePayment(p._id)}
                      disabled={reversingPayId === p._id}
                      className="flex-shrink-0 text-xs font-semibold text-red-500 active:opacity-70 disabled:opacity-40 pt-0.5">
                      {reversingPayId === p._id ? '…' : 'Anular'}
                    </button>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto -mx-5">
                <table className="w-full text-sm min-w-[400px]">
                  <thead>
                    <tr className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="px-5 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-right">Monto</th>
                      <th className="px-3 py-2 text-right">Capital</th>
                      <th className="px-3 py-2 text-right">Interés</th>
                      <th className="px-3 py-2 text-left">Notas</th>
                      <th className="px-3 py-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p._id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-5 py-2.5 text-slate-700">{fmtDate(p.date)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-green-700">{formatCurrency(p.amount, cur)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600">{formatCurrency(p.appliedPrincipal, cur)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600">{formatCurrency(p.appliedInterest, cur)}</td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs">{p.notes ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => reversePayment(p._id)}
                            disabled={reversingPayId === p._id}
                            className="text-xs text-red-500 hover:text-red-700 font-semibold disabled:opacity-40 transition-colors">
                            {reversingPayId === p._id ? '…' : 'Anular'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </SectionCard>

        {/* ── Restructuring & Rescheduling ──────────────────────────────────── */}
        <div id="modifications-panel">
          <ModificationsPanel
            loanId={loanId}
            loanStatus={loan.status}
            currency={cur}
            remainingBalance={loan.remainingBalance}
            overdueInterest={delinquency?.overdueAmount ?? 0}
            unpaidInstallments={installments.filter(i => i.status !== 'paid').map(i => ({
              installmentNumber: i.installmentNumber,
              dueDate: i.dueDate,
              status: i.status,
            }))}
          />
        </div>

        {/* ── Collections ────────────────────────────────────────────────────── */}
        <SectionCard title="Cobranza" emoji="📞"
          action={
            canCollect
              ? <button onClick={() => setShowCollection(true)}
                  className="text-xs text-orange-600 font-semibold hover:underline">+ Registrar</button>
              : undefined
          }>
          {collections.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin acciones de cobranza</p>
          ) : (
            <div className="space-y-3">
              {collections.map(c => (
                <div key={c._id} className="flex gap-3 p-3 rounded-xl bg-slate-50">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
                    style={{ background: '#FFF7ED', border: '1px solid #FDBA74' }}>
                    {c.actionType === 'call' ? '📞' : c.actionType === 'whatsapp' ? '💬'
                      : c.actionType === 'visit' ? '🚶' : c.actionType === 'email' ? '📧' : '📝'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-700">{COLLECTION_ACTION_LABELS[c.actionType]}</span>
                      <span className="text-xs text-slate-400">{fmtDate(c.date)}</span>
                    </div>
                    {c.note && <p className="text-xs text-slate-600">{c.note}</p>}
                    {c.promisedPaymentDate && (
                      <p className="text-xs text-orange-600 font-semibold mt-0.5">
                        Promesa: {fmtDate(c.promisedPaymentDate)}
                        {c.promisedAmount ? ` · ${formatCurrency(c.promisedAmount, cur)}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── MOBILE STICKY ACTION BAR ────────────────────────────────────────── */}
      {hasActions && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-3 py-3"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-2">
            {canDisburse && (
              <button onClick={() => setShowDisburse(true)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white active:opacity-80"
                style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
                Desembolsar
              </button>
            )}
            {canPay && (
              <button onClick={() => setShowPay(true)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white active:opacity-80"
                style={{ background: 'linear-gradient(135deg,#2563EB,#1D4ED8)' }}>
                Pagar
              </button>
            )}
            {canCollect && (
              <button onClick={() => setShowCollection(true)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white active:opacity-80"
                style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
                Cobranza
              </button>
            )}
            {canPay && (
              <button
                onClick={() => {
                  const el = document.getElementById('modifications-panel')
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 active:opacity-80 border-2 border-slate-200 bg-white">
                🔀
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showDisburse && (
        <DisburseModal
          loanId={loanId} amount={loan.amount} currency={cur}
          onClose={() => setShowDisburse(false)}
          onSuccess={() => { setShowDisburse(false); loadData() }} />
      )}
      {showPay && (
        <PayModal
          loanId={loanId} scheduledPayment={loan.scheduledPayment}
          currency={cur} remaining={loan.remainingBalance}
          installments={installments}
          borrower={borrower}
          loanAmount={loan.amount}
          totalInstallments={installments.length}
          profile=""
          onClose={() => setShowPay(false)}
          onSuccess={() => { setShowPay(false); loadData() }} />
      )}
      {showCollection && (
        <CollectionModal
          loanId={loanId}
          onClose={() => setShowCollection(false)}
          onSuccess={() => { setShowCollection(false); loadData() }} />
      )}
    </>
  )
}

// ─── Tiny shared helper ───────────────────────────────────────────────────────
function InfoLine({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-2 py-1 border-b border-slate-50 last:border-0">
      <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex-shrink-0">{label}</span>
      <span className="text-slate-700 text-xs font-medium text-right">{value}</span>
    </div>
  )
}
