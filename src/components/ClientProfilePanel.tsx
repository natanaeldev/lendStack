'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  formatCurrency,
  formatPercent,
  RISK_PROFILES,
  Currency,
  buildAmortization,
  buildWeeklySchedule,
  buildCarritoSchedule,
  getRiskConfig,
  LoanParams,
  RateMode,
  RiskProfile,
  LoanType,
  CarritoFrequency,
} from '@/lib/loan'
import AmortizationTable from '@/components/AmortizationTable'
import PdfExportButton  from '@/components/PdfExport'
import PrintReceiptButton, { PaymentReceiptModal } from '@/components/PaymentReceipt'
import type { ReceiptData } from '@/components/PaymentReceipt'
import EmailModal       from '@/components/EmailModal'
import ToastProvider, { showToast } from '@/components/Toast'
import ClienteStatusBadge from '@/components/clientes/ClienteStatusBadge'

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type LoanStatus = 'pending' | 'approved' | 'denied'

interface ClientDoc {
  id: string; name: string; url: string; type: string; size: number; uploadedAt: string
}
interface Payment {
  id: string; date: string; amount: number; registeredAt: string
  cuotaNumber?: number; notes?: string; comprobanteUrl?: string
}
interface BranchDoc {
  id: string; name: string; type: 'sede' | 'rutas'; createdAt: string
}
interface ClientProfile {
  id: string; savedAt: string; loanStatus: LoanStatus
  name: string; email: string; phone: string
  idType: string; idNumber: string; birthDate: string
  nationality: string; address: string
  occupation: string; monthlyIncome: string; hasIncomeProof: boolean
  currentDebts: string; totalDebtValue: string; paymentCapacity: string
  collateral: string; territorialTies: string
  creditHistory: string; reference1: string; reference2: string; notes: string
  branch: string | null; branchId: string | null; branchName: string | null
  loanType?: LoanType
  params: {
    amount: number; termYears?: number | null; profile: string; currency: Currency; rateMode: string; customMonthlyRate: number
    startDate?: string; termWeeks?: number | null; carritoTerm?: number | null; numPayments?: number | null; frequency?: CarritoFrequency | null
  }
  result: {
    monthlyPayment: number; totalPayment: number; totalInterest: number; annualRate: number; monthlyRate: number; totalMonths: number; interestRatio: number
    weeklyPayment?: number | null; totalWeeks?: number | null; fixedPayment?: number | null; numPayments?: number | null
  }
  documents: ClientDoc[]
  payments: Payment[]
  loanId?: string | null
  lifecycleStatus?: string | null
}

type EditForm = {
  name: string; email: string; phone: string
  idType: string; idNumber: string; birthDate: string
  nationality: string; address: string
  occupation: string; monthlyIncome: string; hasIncomeProof: boolean
  currentDebts: string; totalDebtValue: string; paymentCapacity: string
  collateral: string; territorialTies: string
  creditHistory: string; reference1: string; reference2: string; notes: string
  branchId: string
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STATUS_CFG: Record<LoanStatus, { label: string; emoji: string; bg: string; color: string; border: string; btnBg: string }> = {
  pending:  { label: 'Pendiente', emoji: 'â³', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', btnBg: '#F59E0B' },
  approved: { label: 'Aprobado',  emoji: 'âœ…', bg: '#F0FDF4', color: '#14532D', border: '#86EFAC', btnBg: '#16A34A' },
  denied:   { label: 'Denegado',  emoji: 'âŒ', bg: '#FFF1F2', color: '#881337', border: '#FECDD3', btnBg: '#DC2626' },
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'CL'
}
function docIcon(type: string) {
  return type.includes('pdf') ? 'ðŸ“„' : type.includes('image') ? 'ðŸ–¼ï¸' : type.includes('word') ? 'ðŸ“' : 'ðŸ“'
}
function formatDate(iso: string) {
  if (!iso) return 'â€”'
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return iso }
}

function clientToForm(c: ClientProfile): EditForm {
  return {
    name: c.name, email: c.email, phone: c.phone,
    idType: c.idType, idNumber: c.idNumber, birthDate: c.birthDate,
    nationality: c.nationality, address: c.address,
    occupation: c.occupation, monthlyIncome: c.monthlyIncome, hasIncomeProof: c.hasIncomeProof,
    currentDebts: c.currentDebts, totalDebtValue: c.totalDebtValue, paymentCapacity: c.paymentCapacity,
    collateral: c.collateral, territorialTies: c.territorialTies,
    creditHistory: c.creditHistory, reference1: c.reference1, reference2: c.reference2, notes: c.notes,
    branchId: c.branchId ?? '',
  }
}

function getLoanProfileMeta(client: ClientProfile) {
  const loanType = (client.loanType ?? 'amortized') as LoanType
  const paymentFrequency = loanType === 'weekly' ? 'weekly' : loanType === 'carrito' ? (client.params.frequency ?? 'weekly') : 'monthly'

  const scheduledPayment = loanType === 'weekly'
    ? (client.result.weeklyPayment ?? client.result.monthlyPayment)
    : loanType === 'carrito'
      ? (client.result.fixedPayment ?? client.result.monthlyPayment)
      : client.result.monthlyPayment

  const totalInstallmentsRaw = loanType === 'weekly'
    ? (client.result.totalWeeks ?? client.params.termWeeks ?? client.result.totalMonths)
    : loanType === 'carrito'
      ? (client.result.numPayments ?? client.params.numPayments ?? client.result.totalMonths)
      : client.result.totalMonths

  const totalInstallments = Math.max(1, Number(totalInstallmentsRaw ?? 1))
  const totalPaid = (client.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0)
  const maxRegisteredCuota = (client.payments ?? []).reduce((max, payment) => Math.max(max, payment.cuotaNumber ?? 0), 0)
  const estimatedCovered = scheduledPayment > 0 ? Math.floor((totalPaid + 0.005) / scheduledPayment) : 0
  const paidInstallments = Math.min(totalInstallments, Math.max(maxRegisteredCuota, estimatedCovered))
  const remainingInstallments = Math.max(0, totalInstallments - paidInstallments)
  const nextInstallmentNumber = Math.min(totalInstallments, paidInstallments + 1)

  const installmentLabel = paymentFrequency === 'monthly' ? 'Cuota/mes' : paymentFrequency === 'weekly' ? 'Cuota/semana' : 'Cuota/día'
  const termLabel = loanType === 'weekly'
    ? `${client.params.termWeeks ?? client.result.totalWeeks ?? totalInstallments} semanas`
    : loanType === 'carrito'
      ? `${client.params.carritoTerm ?? totalInstallments} ${paymentFrequency === 'daily' ? 'días' : 'semanas'}`
      : `${client.params.termYears ?? 0} a?os`

  const amortizationTitle = loanType === 'weekly'
    ? `Tabla de pagos - ${totalInstallments} cuotas semanales`
    : loanType === 'carrito'
      ? `Tabla de pagos - ${totalInstallments} cuotas ${paymentFrequency === 'daily' ? 'diarias' : 'semanales'}`
      : `Tabla de amortizaci?n - ${totalInstallments} cuotas`

  return {
    loanType,
    paymentFrequency,
    scheduledPayment,
    totalInstallments,
    totalPaid,
    paidInstallments,
    remainingInstallments,
    nextInstallmentNumber,
    installmentLabel,
    termLabel,
    amortizationTitle,
  }
}

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function InfoBlock({ label, value }: { label: string; value?: string | boolean }) {
  if (!value && value !== false) return null
    const display = typeof value === 'boolean' ? (value ? 'S\u00ED' : 'No') : value
  return (
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/90 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-800">{display}</p>
    </div>
  )
}

function SectionCard({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-[28px] border border-slate-200 bg-white p-4 sm:p-5"
      style={{ boxShadow: '0 16px 36px rgba(15,23,42,.06)' }}
    >
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-base">{emoji}</div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
        </div>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  )
}

// Edit form shared input style
const inputCls = 'w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white'

function EditSectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mt-6 mb-4">
      <span className="text-base">{emoji}</span>
      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</span>
      <div className="flex-1 h-px bg-slate-200 ml-1" />
    </div>
  )
}

function EditField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{label}</label>
      {children}
    </div>
  )
}

// â”€â”€â”€ Props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Props {
  clientId:     string
  onBack:       () => void
  onViewLoan?:  (loanId: string) => void
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ClientProfilePanel({ clientId, onBack, onViewLoan }: Props) {
  const [client,         setClient]        = useState<ClientProfile | null>(null)
  const [loading,        setLoading]       = useState(true)
  const [error,          setError]         = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [uploading,      setUploading]     = useState(false)
  const [emailOpen,      setEmailOpen]     = useState(false)
  const [showAmort,      setShowAmort]     = useState(false)

  // â”€â”€ Edit mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [editMode,  setEditMode]  = useState(false)
  const [editForm,  setEditForm]  = useState<EditForm | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [branches,  setBranches]  = useState<BranchDoc[]>([])

  const [syncingLoan, setSyncingLoan] = useState(false)

  // â”€â”€ Payment registration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [payForm,             setPayForm]             = useState({ date: new Date().toISOString().slice(0, 10), amount: '', cuotaNumber: '', notes: '' })
  const [payLoading,          setPayLoading]          = useState(false)
  const [deletingPayId,       setDeletingPayId]       = useState<string | null>(null)
  const [receiptData,         setReceiptData]         = useState<ReceiptData | null>(null)
  const [payComprobanteFile,  setPayComprobanteFile]  = useState<File | null>(null)
  const [payComprobantePreview, setPayComprobantePreview] = useState<string | null>(null)
  const [lightboxUrl,         setLightboxUrl]         = useState<string | null>(null)
  const comprobanteInputRef = useRef<HTMLInputElement>(null)

  const handlePayComprobanteChange = (file: File) => {
    setPayComprobanteFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPayComprobantePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }
  const clearPayComprobante = () => {
    setPayComprobanteFile(null)
    setPayComprobantePreview(null)
    if (comprobanteInputRef.current) comprobanteInputRef.current.value = ''
  }

  const sf = (k: keyof EditForm) => (v: string | boolean) =>
    setEditForm(prev => prev ? { ...prev, [k]: v } : prev)

  // â”€â”€ Fetch client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadClient = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/clients/${clientId}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al cargar el cliente'); return }
      setClient(data.client)
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { loadClient() }, [loadClient])

  // Load named branches (master-only endpoint; silently ignore 403 for non-masters)
  useEffect(() => {
    fetch('/api/admin/branches')
      .then(r => r.ok ? r.json() : { branches: [] })
      .then(d => setBranches(d.branches ?? []))
      .catch(() => {})
  }, [])

  // â”€â”€ Update status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const updateStatus = async (next: LoanStatus) => {
    if (!client || updatingStatus) return
    const target = client.loanStatus === next ? 'pending' : next
    setUpdatingStatus(true)
    try {
      await fetch(`/api/clients/${clientId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ loanStatus: target }),
      })
      setClient(prev => prev ? { ...prev, loanStatus: target } : prev)
    } catch { /* silent */ }
    setUpdatingStatus(false)
  }

  // â”€â”€ Sync legacy loan to lifecycle system â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const syncLoanToLifecycle = async () => {
    if (!client || syncingLoan) return
    const loanMeta = getLoanProfileMeta(client)
    setSyncingLoan(true)
    try {
      const carritoPayments = client.result.numPayments ?? client.params.numPayments ?? loanMeta.totalInstallments
      const res = await fetch('/api/loans', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId:         clientId,
          loanType:         loanMeta.loanType,
          currency:         client.params.currency,
          amount:           client.params.amount,
          termYears:        client.params.termYears,
          termWeeks:        client.params.termWeeks ?? client.result.totalWeeks ?? undefined,
          carritoTerm:      client.params.carritoTerm ?? undefined,
          carritoPayments:  loanMeta.loanType === 'carrito' ? carritoPayments : undefined,
          carritoFrequency: loanMeta.loanType === 'carrito' ? (client.params.frequency ?? 'weekly') : undefined,
          profile:          client.params.profile,
          rateMode:         client.params.rateMode,
          customMonthlyRate: client.params.customMonthlyRate,
          annualRate:       client.result.annualRate,
          monthlyRate:      client.result.monthlyRate,
          totalMonths:      loanMeta.loanType === 'amortized' ? client.result.totalMonths : undefined,
          totalWeeks:       loanMeta.loanType === 'weekly' ? (client.result.totalWeeks ?? client.params.termWeeks ?? loanMeta.totalInstallments) : undefined,
          scheduledPayment: loanMeta.scheduledPayment,
          totalPayment:     client.result.totalPayment,
          totalInterest:    client.result.totalInterest,
          startDate:        client.params.startDate ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { showToast('âŒ', data.error ?? 'Error al sincronizar'); return }
      showToast('ðŸ’³', 'PrÃ©stamo registrado en el sistema')
      loadClient()
    } catch { showToast('âŒ', 'Error de red') }
    finally { setSyncingLoan(false) }
  }

  // â”€â”€ Open edit mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openEdit = () => {
    if (!client) return
    setEditForm(clientToForm(client))
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
    setEditForm(null)
  }

  // â”€â”€ Save edits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const saveEdit = async () => {
    if (!editForm || saving) return
    if (!editForm.name.trim()) { showToast('âš ï¸', 'El nombre es obligatorio'); return }
    setSaving(true)
    try {
      // Transform branchId: '' â†’ null (empty string = "clear branch assignment")
      const { branchId: rawBranchId, ...rest } = editForm
      const branchId = rawBranchId || null
      const res = await fetch(`/api/clients/${clientId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...rest, branchId }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast('âŒ', data.error ?? 'Error al guardar')
        return
      }
      // Optimistic update â€” derive branch type + name from local branches cache
      const selectedBranch = branchId ? branches.find(b => b.id === branchId) : null
      setClient(prev => prev ? {
        ...prev, ...rest,
        branchId,
        branch:     branchId ? (selectedBranch?.type ?? prev.branch) : null,
        branchName: branchId ? (selectedBranch?.name ?? prev.branchName) : null,
      } : prev)
      setEditMode(false)
      setEditForm(null)
      showToast('âœ…', 'Datos del cliente actualizados')
    } catch {
      showToast('âŒ', 'No se pudo conectar')
    } finally {
      setSaving(false)
    }
  }

  // â”€â”€ Register payment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const registerPayment = async () => {
    const amount = parseFloat(payForm.amount)
    if (!payForm.date || isNaN(amount) || amount <= 0) {
      showToast('âš ï¸', 'CompletÃ¡ la fecha y un monto vÃ¡lido')
      return
    }
    setPayLoading(true)
    try {
      // Use FormData so we can attach the comprobante image
      const fd = new FormData()
      fd.append('date',   payForm.date)
      fd.append('amount', String(amount))
      const cuotaToRegister = payForm.cuotaNumber || String(loanMeta.nextInstallmentNumber)
      if (cuotaToRegister) fd.append('cuotaNumber', cuotaToRegister)
      if (payForm.notes.trim()) fd.append('notes', payForm.notes.trim())
      if (payComprobanteFile)   fd.append('comprobante', payComprobanteFile)

      const res = await fetch(`/api/clients/${clientId}/payments`, {
        method: 'POST',
        body:   fd,
      })
      if (!res.ok) { const d = await res.json(); showToast('âŒ', d.error ?? 'Error'); return }
      const { payment } = await res.json()
      setClient(prev => prev ? { ...prev, payments: [...prev.payments, payment] } : prev)
      setPayForm({ date: new Date().toISOString().slice(0, 10), amount: '', cuotaNumber: '', notes: '' })
      clearPayComprobante()
      showToast('âœ…', 'Pago registrado correctamente')
      // Show inline receipt modal (avoids browser popup blockers)
      if (client) setReceiptData({
        clientName:     client.name,
        clientIdType:   client.idType,
        clientId:       client.idNumber,
        clientEmail:    client.email,
        paymentId:      payment.id,
        date:           payment.date,
        amount:         payment.amount,
        cuotaNumber:    payment.cuotaNumber,
        notes:          payment.notes,
        currency:       client.params.currency,
        loanAmount:     client.params.amount,
        monthlyPayment: loanMeta.scheduledPayment,
        totalMonths:    loanMeta.totalInstallments,
        profile:        client.params.profile,
      })
    } catch { showToast('âŒ', 'No se pudo conectar') }
    finally  { setPayLoading(false) }
  }

  const deletePayment = async (paymentId: string) => {
    setDeletingPayId(paymentId)
    try {
      await fetch(`/api/clients/${clientId}/payments`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paymentId }),
      })
      setClient(prev => prev ? { ...prev, payments: prev.payments.filter(p => p.id !== paymentId) } : prev)
    } catch { /* silent */ }
    setDeletingPayId(null)
  }

  // â”€â”€ Upload document â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const uploadDoc = async (file: File) => {
    if (!client) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, { method: 'POST', body: fd })
      if (res.ok) {
        const { document } = await res.json()
        setClient(prev => prev ? { ...prev, documents: [...prev.documents, document] } : prev)
      }
    } finally { setUploading(false) }
  }

  // â”€â”€ Render states â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-500">Cargando perfil del clienteâ€¦</p>
      </div>
    </div>
  )

  if (error || !client) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">ðŸ˜•</p>
        <p className="text-slate-700 font-semibold mb-2">{error || 'Cliente no encontrado'}</p>
        <button onClick={onBack} className="text-sm text-blue-600 underline">â† Volver a la lista</button>
      </div>
    </div>
  )

  const sCfg = STATUS_CFG[client.loanStatus]
  const cfg  = RISK_PROFILES.find(r => r.label === client.params.profile)!
  const cur  = client.params.currency
  const fmt  = (v: number) => formatCurrency(v, cur)

  const loanMeta = getLoanProfileMeta(client)
  const startDate = client.params.startDate ? new Date(client.params.startDate) : new Date()
  const carritoTerm = client.params.carritoTerm ?? loanMeta.totalInstallments
  const carritoPayments = client.result.numPayments ?? client.params.numPayments ?? loanMeta.totalInstallments
  const carritoFlatRate = carritoTerm > 0
    ? client.result.totalInterest / Math.max(client.params.amount * carritoTerm, 1)
    : 0
  const loanParams: LoanParams = {
    amount:            client.params.amount,
    termYears:         client.params.termYears ?? 0,
    profile:           client.params.profile as RiskProfile,
    currency:          client.params.currency,
    rateMode:          (client.params.rateMode as RateMode) ?? 'annual',
    customMonthlyRate: client.params.customMonthlyRate ?? 0,
    startDate:         client.params.startDate ?? '',
  }
  const riskCfg = getRiskConfig(client.params.profile as RiskProfile)
  const amortRows = loanMeta.loanType === 'weekly'
    ? buildWeeklySchedule(
        client.params.amount,
        client.params.termWeeks ?? client.result.totalWeeks ?? loanMeta.totalInstallments,
        client.result.monthlyRate,
        startDate,
      ).map((row, index, rows) => ({
        month: row.period,
        openingBalance: index === 0 ? client.params.amount : rows[index - 1].balance,
        payment: row.payment,
        principal: row.principal,
        interest: row.interest,
        closingBalance: row.balance,
        cumInterest: row.cumInterest,
        cumPrincipal: row.cumPrincipal,
      }))
    : loanMeta.loanType === 'carrito'
      ? buildCarritoSchedule(
          client.params.amount,
          carritoFlatRate,
          carritoTerm,
          carritoPayments,
          (client.params.frequency ?? 'weekly') as CarritoFrequency,
          startDate,
        ).map((row, index, rows) => ({
          month: row.period,
          openingBalance: index === 0 ? client.params.amount : rows[index - 1].balance,
          payment: row.payment,
          principal: row.principal,
          interest: row.interest,
          closingBalance: row.balance,
          cumInterest: row.cumInterest,
          cumPrincipal: row.cumPrincipal,
        }))
      : buildAmortization(loanParams)

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // EDIT MODE
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (editMode && editForm) {
    return (
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={cancelEdit}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            style={{ background: '#e8eef7', color: '#0D2B5E' }}>
            â† Cancelar
          </button>
          <span className="text-sm font-bold" style={{ color: '#0D2B5E' }}>
            âœï¸ Editando: {client.name}
          </span>
          <div className="ml-auto flex gap-3">
            <button onClick={cancelEdit}
              className="px-5 py-2.5 rounded-xl text-sm font-bold border-2 border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button onClick={saveEdit} disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
              {saving ? 'â³ Guardando...' : 'ðŸ’¾ Guardar cambios'}
            </button>
          </div>
        </div>

        {/* Edit form card */}
        <div className="rounded-2xl p-6 bg-white border border-slate-200"
          style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>

          {/* SecciÃ³n 1 â€” Personal */}
          <EditSectionHeader emoji="ðŸ‘¤" title="SecciÃ³n 1 â€” InformaciÃ³n Personal" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <EditField label="Nombre completo *">
              <input type="text" value={editForm.name} onChange={e => sf('name')(e.target.value)}
                className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Correo electrÃ³nico">
              <input type="email" value={editForm.email} onChange={e => sf('email')(e.target.value)}
                className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="TelÃ©fono">
              <input type="text" value={editForm.phone} onChange={e => sf('phone')(e.target.value)}
                placeholder="+54 11 1234-5678" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Tipo y nÃºmero de identificaciÃ³n">
              <div className="flex gap-2">
                <select value={editForm.idType} onChange={e => sf('idType')(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
                  style={{ color: '#374151', minWidth: '80px' }}>
                  {['DNI','CUIT','CUIL','Pasaporte','RUT','RUC','CC','NIT','CÃ©dula'].map(t =>
                    <option key={t}>{t}</option>)}
                </select>
                <input type="text" value={editForm.idNumber} onChange={e => sf('idNumber')(e.target.value)}
                  placeholder="NÃºmero de documento" className={inputCls} style={{ color: '#374151' }} />
              </div>
            </EditField>

            <EditField label="Fecha de nacimiento">
              <input type="date" value={editForm.birthDate} onChange={e => sf('birthDate')(e.target.value)}
                className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Nacionalidad">
              <input type="text" value={editForm.nationality} onChange={e => sf('nationality')(e.target.value)}
                placeholder="Ej: Argentina" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="DirecciÃ³n actual" full>
              <input type="text" value={editForm.address} onChange={e => sf('address')(e.target.value)}
                placeholder="Calle, nÃºmero, ciudad, provincia" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

          </div>

          {/* SecciÃ³n 2 â€” Financiera */}
          <EditSectionHeader emoji="ðŸ’°" title="SecciÃ³n 2 â€” InformaciÃ³n Financiera" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <EditField label="OcupaciÃ³n / Empleador">
              <input type="text" value={editForm.occupation} onChange={e => sf('occupation')(e.target.value)}
                className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Ingresos mensuales">
              <input type="text" value={editForm.monthlyIncome} onChange={e => sf('monthlyIncome')(e.target.value)}
                placeholder="Ej: ARS 450.000 / USD 2.000" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Adjunta comprobantes de ingresos">
              <div className="flex items-center gap-3 h-[46px] px-4 rounded-xl border-2 border-slate-200">
                {[true, false].map(val => (
                  <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={editForm.hasIncomeProof === val}
                      onChange={() => sf('hasIncomeProof')(val)}
                      className="accent-blue-600" />
                    <span className="text-sm text-slate-700">{val ? 'SÃ­' : 'No'}</span>
                  </label>
                ))}
              </div>
            </EditField>

            <EditField label="Valor total de deudas">
              <input type="text" value={editForm.totalDebtValue} onChange={e => sf('totalDebtValue')(e.target.value)}
                placeholder="Ej: ARS 200.000" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Detalle de deudas actuales" full>
              <input type="text" value={editForm.currentDebts} onChange={e => sf('currentDebts')(e.target.value)}
                className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Capacidad de pago mensual estimada" full>
              <input type="text" value={editForm.paymentCapacity} onChange={e => sf('paymentCapacity')(e.target.value)}
                placeholder="Ej: ARS 150.000 / mes" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

          </div>

          {/* SecciÃ³n 3 â€” GarantÃ­as */}
          <EditSectionHeader emoji="ðŸ " title="SecciÃ³n 3 â€” GarantÃ­as y Arraigo" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <EditField label="Colateral disponible" full>
              <input type="text" value={editForm.collateral} onChange={e => sf('collateral')(e.target.value)}
                placeholder="Ej: Inmueble valuado en USD 120.000" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Arraigo territorial" full>
              <input type="text" value={editForm.territorialTies} onChange={e => sf('territorialTies')(e.target.value)}
                placeholder="Ej: 15 aÃ±os de residencia, propietario, empleo estable" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

          </div>

          {/* SecciÃ³n 4 â€” Historial */}
          <EditSectionHeader emoji="ðŸ“‹" title="SecciÃ³n 4 â€” Historial y Referencias" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <EditField label="Historial crediticio" full>
              <input type="text" value={editForm.creditHistory} onChange={e => sf('creditHistory')(e.target.value)}
                placeholder="Ej: Sin incumplimientos / Mora en 2023 saldada" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Referencia 1">
              <input type="text" value={editForm.reference1} onChange={e => sf('reference1')(e.target.value)}
                placeholder="Nombre y telÃ©fono" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Referencia 2">
              <input type="text" value={editForm.reference2} onChange={e => sf('reference2')(e.target.value)}
                placeholder="Nombre y telÃ©fono" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Notas del asesor" full>
              <input type="text" value={editForm.notes} onChange={e => sf('notes')(e.target.value)}
                placeholder="Observaciones adicionales" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

          </div>

          {/* SecciÃ³n 5 â€” Sucursal */}
          <EditSectionHeader emoji="ðŸ¢" title="SecciÃ³n 5 â€” Sucursal Asignada" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EditField label="Sucursal" full>
              {branches.length > 0 ? (
                <select value={editForm.branchId} onChange={e => sf('branchId')(e.target.value)}
                  className={inputCls} style={{ color: editForm.branchId ? '#374151' : '#94a3b8' }}>
                  <option value="">â€” Sin asignar â€”</option>
                  {(['sede', 'rutas'] as const).map(type => {
                    const group = branches.filter(b => b.type === type)
                    if (!group.length) return null
                    return (
                      <optgroup key={type} label={type === 'sede' ? 'ðŸ¢ Sede' : 'ðŸ›£ï¸ Rutas'}>
                        {group.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </optgroup>
                    )
                  })}
                </select>
              ) : (
                <p className="text-sm text-slate-400 px-4 py-2.5 rounded-xl border-2 border-slate-100 bg-slate-50">
                  No hay sucursales creadas â€” creÃ¡ una en <span className="font-semibold">Admin â†’ Sucursales</span>.
                </p>
              )}
            </EditField>
          </div>

          {/* Bottom save row */}
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-slate-100">
            <button onClick={saveEdit} disabled={saving}
              className="px-8 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
              {saving ? 'â³ Guardando...' : 'ðŸ’¾ Guardar cambios'}
            </button>
            <button onClick={cancelEdit}
              className="px-5 py-3 rounded-xl text-sm font-bold border-2 border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
          </div>
        </div>

        <ToastProvider />
      </div>
    )
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // VIEW MODE
  return (
    <div className="space-y-6 sm:space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          onClick={onBack}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
        >
          {'\u2190 Volver a clientes'}
        </button>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 sm:ml-1">Perfil del cliente</span>
        <button
          onClick={openEdit}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-5 text-sm font-bold text-blue-700 transition hover:bg-blue-100 sm:ml-auto sm:w-auto"
        >
          Editar cliente
        </button>
      </div>

      <section
        className="overflow-hidden rounded-[30px] border-2 bg-white"
        style={{ boxShadow: '0 18px 42px rgba(15,23,42,.08)', borderColor: sCfg.border }}
      >
        <div className="h-1.5" style={{ background: `linear-gradient(90deg,${sCfg.btnBg},${sCfg.border})` }} />
        <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white sm:h-20 sm:w-20 sm:text-2xl"
              style={{ background: 'linear-gradient(135deg,#1565C0,#0D2B5E)' }}
            >
              {initials(client.name)}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="break-words text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{client.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ClienteStatusBadge label={cfg.label} tone="info" />
                <ClienteStatusBadge
                  label={sCfg.label}
                  tone={client.loanStatus === 'approved' ? 'success' : client.loanStatus === 'denied' ? 'danger' : 'warning'}
                />
                {(client.branchName || client.branch) && (
                  <ClienteStatusBadge label={client.branchName ?? (client.branch === 'sede' ? 'Sede' : 'Rutas')} tone="neutral" />
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {client.phone && (
                  <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 sm:px-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{'Tel\u00E9fono'}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-800">{client.phone}</p>
                  </div>
                )}
                {client.email && (
                  <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 sm:px-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Email</p>
                    <p className="mt-1 break-all text-sm font-semibold text-slate-800">{client.email}</p>
                  </div>
                )}
                {client.idNumber && (
                  <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 sm:px-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{'Identificaci\u00F3n'}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-800">{client.idType}: {client.idNumber}</p>
                  </div>
                )}
                {client.nationality && (
                  <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 sm:px-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Nacionalidad</p>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-800">{client.nationality}</p>
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs font-medium text-slate-400">Solicitud registrada el {formatDate(client.savedAt)}</p>
            </div>

            <div className="grid shrink-0 gap-2 sm:w-[210px] lg:pt-1">
              <button
                onClick={() => updateStatus('approved')}
                disabled={updatingStatus}
                className="min-h-11 rounded-2xl px-4 py-3 text-sm font-bold transition disabled:opacity-40"
                style={{
                  background: client.loanStatus === 'approved' ? '#16A34A' : '#F0FDF4',
                  color: client.loanStatus === 'approved' ? '#fff' : '#15803D',
                  border: `2px solid ${client.loanStatus === 'approved' ? '#16A34A' : '#86EFAC'}`,
                }}
              >
                {client.loanStatus === 'approved' ? 'Aprobado' : 'Aprobar'}
              </button>
              <button
                onClick={() => updateStatus('denied')}
                disabled={updatingStatus}
                className="min-h-11 rounded-2xl px-4 py-3 text-sm font-bold transition disabled:opacity-40"
                style={{
                  background: client.loanStatus === 'denied' ? '#DC2626' : '#FFF1F2',
                  color: client.loanStatus === 'denied' ? '#fff' : '#DC2626',
                  border: `2px solid ${client.loanStatus === 'denied' ? '#DC2626' : '#FECDD3'}`,
                }}
              >
                {client.loanStatus === 'denied' ? 'Denegado' : 'Denegar'}
              </button>
              {client.loanStatus !== 'pending' && (
                <button
                  onClick={() => updateStatus('pending')}
                  disabled={updatingStatus}
                  className="min-h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                >
                  Restablecer estado
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {onViewLoan && client.loanId && (
          <button
            onClick={() => onViewLoan(client.loanId!)}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 sm:w-auto"
          >
            {'Ver pr\u00E9stamo completo'}
          </button>
        )}
        {!client.loanId && client.params && (
          <button
            onClick={syncLoanToLifecycle}
            disabled={syncingLoan}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border-2 border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition disabled:opacity-50 sm:w-auto"
          >
            {syncingLoan ? 'Registrando\u2026' : 'Registrar en sistema de pr\u00E9stamos'}
          </button>
        )}
        <PdfExportButton params={loanParams} result={client.result} config={riskCfg} />
        <button
          onClick={() => setEmailOpen(true)}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
        >
          Enviar por email
        </button>
      </div>

      <section className="overflow-hidden rounded-[28px] bg-white" style={{ boxShadow: '0 16px 36px rgba(15,23,42,.06)' }}>
        <div className="flex items-center gap-2 bg-slate-950 px-5 py-3 text-white">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-200">{'Resumen del pr\u00E9stamo'}</span>
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'Monto', big: fmt(client.params.amount) },
              { label: loanMeta.installmentLabel, big: fmt(loanMeta.scheduledPayment) },
              { label: 'Plazo', big: loanMeta.termLabel },
              { label: 'Tasa', big: formatPercent(client.result.annualRate) },
              { label: 'Total', big: fmt(client.result.totalPayment) },
              { label: 'Intereses', big: fmt(client.result.totalInterest) },
            ].map(({ label, big }) => (
              <div key={label} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
                <p className="mt-1 break-words text-sm font-black leading-6 text-slate-950 sm:text-base">{big}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div>
        <button
          onClick={() => setShowAmort(s => !s)}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition"
          style={{ background: showAmort ? '#0D2B5E' : '#e8eef7', color: showAmort ? '#fff' : '#0D2B5E', borderColor: showAmort ? '#0D2B5E' : '#c5d5ea' }}
        >
          {showAmort ? 'Ocultar tabla de amortizaci\u00F3n' : 'Ver tabla de amortizaci\u00F3n'}
        </button>
        {showAmort && (
          <div className="mt-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white" style={{ boxShadow: '0 16px 36px rgba(15,23,42,.06)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{loanMeta.amortizationTitle}</span>
              <ClienteStatusBadge label={cfg.label} tone="info" />
            </div>
            <div className="p-5">
              <AmortizationTable rows={amortRows} accentColor={riskCfg.colorAccent} currency={cur} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard emoji={'\u{1F464}'} title={'Informaci\u00F3n personal'}>
          <InfoBlock label="Fecha de nacimiento" value={client.birthDate} />
          <InfoBlock label="Nacionalidad" value={client.nationality} />
          <InfoBlock label={'Direcci\u00F3n'} value={client.address} />
          <InfoBlock label="Tipo de ID" value={client.idType} />
          <InfoBlock label={'N\u00FAmero de ID'} value={client.idNumber} />
        </SectionCard>
        <SectionCard emoji={'\u{1F4B0}'} title={'Informaci\u00F3n financiera'}>
          <InfoBlock label={'Ocupaci\u00F3n / Empleador'} value={client.occupation} />
          <InfoBlock label="Ingresos mensuales" value={client.monthlyIncome} />
          <InfoBlock label="Adjunta comprobantes" value={client.hasIncomeProof} />
          <InfoBlock label="Detalle de deudas actuales" value={client.currentDebts} />
          <InfoBlock label="Valor total de deudas" value={client.totalDebtValue} />
          <InfoBlock label="Capacidad de pago mensual" value={client.paymentCapacity} />
        </SectionCard>
        <SectionCard emoji={'\u{1F3E0}'} title={'Garant\u00EDas y arraigo'}>
          <InfoBlock label="Colateral disponible" value={client.collateral} />
          <InfoBlock label="Arraigo territorial" value={client.territorialTies} />
        </SectionCard>
        <SectionCard emoji={'\u{1F4CB}'} title="Historial y referencias">
          <InfoBlock label="Historial crediticio" value={client.creditHistory} />
          <InfoBlock label="Referencia 1" value={client.reference1} />
          <InfoBlock label="Referencia 2" value={client.reference2} />
          <InfoBlock label="Notas del asesor" value={client.notes} />
        </SectionCard>
      </div>

      {(() => {
        const payments = client.payments ?? []
        const totalPaid = loanMeta.totalPaid
        const totalMonths = loanMeta.totalInstallments
        const paidCount = loanMeta.paidInstallments
        const remaining = loanMeta.remainingInstallments
        const progress = Math.min(100, Math.round((totalPaid / client.result.totalPayment) * 100))
        return (
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white" style={{ boxShadow: '0 16px 36px rgba(15,23,42,.06)' }}>
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Historial de pagos</p>
                <p className="mt-1 text-sm text-slate-500">{paidCount} pago{paidCount !== 1 ? 's' : ''} registrado{paidCount !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="space-y-5 px-4 py-4 sm:px-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Cuotas pagadas', value: String(paidCount), tone: paidCount > 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-700 bg-slate-50 border-slate-200' },
                  { label: 'Cuotas restantes', value: String(remaining), tone: remaining === 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-700 bg-slate-50 border-slate-200' },
                  { label: 'Cuotas totales', value: String(totalMonths), tone: 'text-slate-700 bg-slate-50 border-slate-200' },
                  { label: 'Monto pagado', value: fmt(totalPaid), tone: 'text-blue-700 bg-blue-50 border-blue-200' },
                ].map(card => (
                  <div key={card.label} className={`rounded-2xl border px-3 py-3 ${card.tone}`}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{card.label}</p>
                    <p className="mt-1 break-words text-lg font-black">{card.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: progress >= 100 ? '#16A34A' : 'linear-gradient(90deg,#1565C0,#0D2B5E)' }} />
                </div>
                <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-500">{progress}% del total cubierto</span>
                  <span className="text-slate-400">{'Total pr\u00E9stamo: '}<span className="font-bold text-slate-700">{fmt(client.result.totalPayment)}</span></span>
                </div>
              </div>

              {payments.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <div className="hidden items-center gap-4 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:flex">
                    <span className="w-14 shrink-0">Cuota</span>
                    <span className="w-28 shrink-0">Monto</span>
                    <span className="w-36 shrink-0">Fecha</span>
                    <span className="flex-1">Notas</span>
                    <span className="w-20 shrink-0 text-right">Acciones</span>
                  </div>
                  {[...payments].reverse().map((p, i) => (
                    <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0 sm:flex-nowrap" style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <div className="w-14 shrink-0">
                        <span className="inline-flex rounded-lg px-2 py-1 text-xs font-black" style={{ background: p.cuotaNumber ? '#e8eef7' : '#f1f5f9', color: p.cuotaNumber ? '#1565C0' : '#94a3b8' }}>
                          {p.cuotaNumber ? `#${p.cuotaNumber}` : '—'}
                        </span>
                      </div>
                      <p className="w-28 shrink-0 text-sm font-black text-slate-900">{fmt(p.amount)}</p>
                      <p className="w-36 shrink-0 text-xs text-slate-500">{formatDate(p.date)}</p>
                      <p className="min-w-0 flex-1 break-words text-xs leading-5 text-slate-500">{p.notes ?? '—'}</p>
                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        {p.comprobanteUrl && (
                          <button onClick={() => setLightboxUrl(p.comprobanteUrl!)} className="h-8 w-8 overflow-hidden rounded-lg border border-slate-200 transition hover:border-blue-400" title="Ver comprobante">
                            <img src={p.comprobanteUrl} alt="Comprobante" className="h-full w-full object-cover" />
                          </button>
                        )}
                        <PrintReceiptButton
                          data={{
                            clientName: client.name,
                            clientIdType: client.idType,
                            clientId: client.idNumber,
                            clientEmail: client.email,
                            paymentId: p.id,
                            date: p.date,
                            amount: p.amount,
                            cuotaNumber: p.cuotaNumber,
                            notes: p.notes,
                            currency: client.params.currency,
                            loanAmount: client.params.amount,
                            monthlyPayment: loanMeta.scheduledPayment,
                            totalMonths: loanMeta.totalInstallments,
                            profile: client.params.profile,
                          }}
                        />
                        <button onClick={() => deletePayment(p.id)} disabled={deletingPayId === p.id} className="text-xs text-slate-300 transition hover:text-red-400 disabled:opacity-40" title="Eliminar pago">{deletingPayId === p.id ? '⏳' : '✕'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-slate-500">{'Sin pagos registrados todav\u00EDa.'}</p>
                  <p className="mt-1 text-xs text-slate-400">{'Us\u00E1 el formulario de abajo para registrar el primer pago.'}</p>
                </div>
              )}

              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Registrar nuevo pago</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs text-slate-500">Fecha *</label>
                    <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" style={{ color: '#374151' }} />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs text-slate-500">Monto *</label>
                    <input type="number" min="0" step="0.01" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder={`Ej: ${loanMeta.scheduledPayment.toFixed(2)}`} className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" style={{ color: '#374151' }} />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs text-slate-500">{'N.\u00BA de cuota'}</label>
                    <input type="number" min="1" max={totalMonths} value={payForm.cuotaNumber} onChange={e => setPayForm(f => ({ ...f, cuotaNumber: e.target.value }))} placeholder={paidCount < totalMonths ? `Siguiente: ${loanMeta.nextInstallmentNumber}` : `1 - ${totalMonths}`} className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" style={{ color: '#374151' }} />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs text-slate-500">Notas</label>
                    <input type="text" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder={'Ej: pago parcial, en efectivo\u2026'} className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" style={{ color: '#374151' }} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs text-slate-500">Comprobante</label>
                  {payComprobantePreview ? (
                    <div className="relative overflow-hidden rounded-xl border-2 border-blue-200 bg-slate-50">
                      <img src={payComprobantePreview} alt="Comprobante" className="max-h-40 w-full object-contain" />
                      <button onClick={clearPayComprobante} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: '#DC2626' }} title="Quitar imagen">{'\u2715'}</button>
                      <p className="border-t border-slate-100 px-3 py-1 text-xs text-slate-400 break-words">{payComprobanteFile?.name}</p>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 transition hover:border-blue-400 hover:bg-blue-50">
                      <input ref={comprobanteInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handlePayComprobanteChange(f); e.target.value = '' }} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-700">Adjuntar comprobante</p>
                        <p className="mt-0.5 text-xs text-slate-400">{'Us\u00E1 la c\u00E1mara o eleg\u00ED una imagen'}</p>
                      </div>
                    </label>
                  )}
                </div>
                <button onClick={registerPayment} disabled={payLoading} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40 sm:w-auto">{payLoading ? 'Registrando…' : 'Registrar pago'}</button>
              </div>
            </div>
          </section>
        )
      })()}

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white" style={{ boxShadow: '0 16px 36px rgba(15,23,42,.06)' }}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Documentos adjuntos</p>
          <span className="ml-auto text-sm text-slate-400">{client.documents.length} archivo{client.documents.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="px-5 py-4">
          {client.documents.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-3">
              {client.documents.map(doc => (
                <a
                  key={doc.id}
                  href={doc.url.startsWith('data:') ? doc.url : `/api/clients/${clientId}/documents/${doc.id}/presign`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-w-0 max-w-full flex-col gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-blue-300 hover:bg-blue-50"
                  style={{ minWidth: '160px' }}
                >
                  <span className="text-2xl">{docIcon(doc.type)}</span>
                  <span className="break-words text-xs font-semibold leading-5 text-slate-700 group-hover:text-blue-700">{doc.name}</span>
                  <span className="text-xs text-slate-400">{`${(doc.size / 1024).toFixed(0)} KB \u00B7 ${formatDate(doc.uploadedAt)}`}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-slate-400">{'Sin documentos adjuntos todav\u00EDa.'}</p>
          )}
          <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed px-4 text-sm font-semibold transition ${uploading ? 'cursor-not-allowed opacity-50' : 'hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600'}`} style={{ borderColor: '#c5d5ea', color: '#64748b' }}>
            <input type="file" className="hidden" disabled={uploading} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xlsx" onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f); e.target.value = '' }} />
            {uploading ? 'Subiendo…' : 'Adjuntar documento'}
          </label>
          <p className="mt-1.5 text-xs text-slate-400">PDF, Word, Excel, im\u00E1genes · M\u00E1x. 10 MB</p>
        </div>
      </section>

      <EmailModal
        isOpen={emailOpen}
        onClose={() => setEmailOpen(false)}
        params={loanParams}
        result={client.result}
        config={riskCfg}
        defaultTo={client.email ?? ''}
      />

      {receiptData && <PaymentReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />}

      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(7,26,62,.85)', backdropFilter: 'blur(6px)' }} onClick={() => setLightboxUrl(null)}>
          <div className="relative w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <img src={lightboxUrl} alt="Comprobante" className="max-h-[80vh] w-full rounded-2xl object-contain shadow-2xl" />
            <button onClick={() => setLightboxUrl(null)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white transition hover:opacity-80" style={{ background: 'rgba(0,0,0,.5)' }}>?</button>
            <a href={lightboxUrl} target="_blank" rel="noopener noreferrer" className="absolute bottom-3 right-3 rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{ background: 'rgba(0,0,0,.5)' }} onClick={e => e.stopPropagation()}>
              Ver original
            </a>
          </div>
        </div>
      )}

      <ToastProvider />
    </div>
  )
}
