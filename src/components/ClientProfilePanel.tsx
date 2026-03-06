'use client'
import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatPercent, RISK_PROFILES, Currency, buildAmortization, getRiskConfig, LoanParams, RateMode, RiskProfile } from '@/lib/loan'
import AmortizationTable from '@/components/AmortizationTable'
import PdfExportButton  from '@/components/PdfExport'
import EmailModal       from '@/components/EmailModal'
import ToastProvider, { showToast } from '@/components/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type LoanStatus = 'pending' | 'approved' | 'denied'

interface ClientDoc {
  id: string; name: string; url: string; type: string; size: number; uploadedAt: string
}
interface Payment {
  id: string; date: string; amount: number; registeredAt: string
  cuotaNumber?: number; notes?: string
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
  params: { amount: number; termYears: number; profile: string; currency: Currency; rateMode: string; customMonthlyRate: number }
  result: { monthlyPayment: number; totalPayment: number; totalInterest: number; annualRate: number; monthlyRate: number; totalMonths: number; interestRatio: number }
  documents: ClientDoc[]
  payments: Payment[]
}

type EditForm = {
  name: string; email: string; phone: string
  idType: string; idNumber: string; birthDate: string
  nationality: string; address: string
  occupation: string; monthlyIncome: string; hasIncomeProof: boolean
  currentDebts: string; totalDebtValue: string; paymentCapacity: string
  collateral: string; territorialTies: string
  creditHistory: string; reference1: string; reference2: string; notes: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<LoanStatus, { label: string; emoji: string; bg: string; color: string; border: string; btnBg: string }> = {
  pending:  { label: 'Pendiente', emoji: '⏳', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', btnBg: '#F59E0B' },
  approved: { label: 'Aprobado',  emoji: '✅', bg: '#F0FDF4', color: '#14532D', border: '#86EFAC', btnBg: '#16A34A' },
  denied:   { label: 'Denegado',  emoji: '❌', bg: '#FFF1F2', color: '#881337', border: '#FECDD3', btnBg: '#DC2626' },
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}
function docIcon(type: string) {
  return type.includes('pdf') ? '📄' : type.includes('image') ? '🖼️' : type.includes('word') ? '📝' : '📁'
}
function formatDate(iso: string) {
  if (!iso) return '—'
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
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoBlock({ label, value }: { label: string; value?: string | boolean }) {
  if (!value && value !== false) return null
  const display = typeof value === 'boolean' ? (value ? 'Sí' : 'No') : value
  return (
    <div className="py-2.5 border-b border-slate-100 last:border-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 font-medium">{display}</p>
    </div>
  )
}

function SectionCard({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2"
        style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
        <span className="text-base">{emoji}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</span>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string
  onBack:   () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientProfilePanel({ clientId, onBack }: Props) {
  const [client,         setClient]        = useState<ClientProfile | null>(null)
  const [loading,        setLoading]       = useState(true)
  const [error,          setError]         = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [uploading,      setUploading]     = useState(false)
  const [emailOpen,      setEmailOpen]     = useState(false)
  const [showAmort,      setShowAmort]     = useState(false)

  // ── Edit mode ──────────────────────────────────────────────────────────────
  const [editMode,  setEditMode]  = useState(false)
  const [editForm,  setEditForm]  = useState<EditForm | null>(null)
  const [saving,    setSaving]    = useState(false)

  // ── Payment registration ────────────────────────────────────────────────────
  const [payForm,    setPayForm]    = useState({ date: new Date().toISOString().slice(0, 10), amount: '', cuotaNumber: '', notes: '' })
  const [payLoading, setPayLoading] = useState(false)
  const [deletingPayId, setDeletingPayId] = useState<string | null>(null)

  const sf = (k: keyof EditForm) => (v: string | boolean) =>
    setEditForm(prev => prev ? { ...prev, [k]: v } : prev)

  // ── Fetch client ───────────────────────────────────────────────────────────
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

  // ── Update status ──────────────────────────────────────────────────────────
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

  // ── Open edit mode ─────────────────────────────────────────────────────────
  const openEdit = () => {
    if (!client) return
    setEditForm(clientToForm(client))
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
    setEditForm(null)
  }

  // ── Save edits ─────────────────────────────────────────────────────────────
  const saveEdit = async () => {
    if (!editForm || saving) return
    if (!editForm.name.trim()) { showToast('⚠️', 'El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(editForm),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast('❌', data.error ?? 'Error al guardar')
        return
      }
      // Apply locally
      setClient(prev => prev ? { ...prev, ...editForm } : prev)
      setEditMode(false)
      setEditForm(null)
      showToast('✅', 'Datos del cliente actualizados')
    } catch {
      showToast('❌', 'No se pudo conectar')
    } finally {
      setSaving(false)
    }
  }

  // ── Register payment ───────────────────────────────────────────────────────
  const registerPayment = async () => {
    const amount = parseFloat(payForm.amount)
    if (!payForm.date || isNaN(amount) || amount <= 0) {
      showToast('⚠️', 'Completá la fecha y un monto válido')
      return
    }
    setPayLoading(true)
    try {
      const body: Record<string, any> = { date: payForm.date, amount }
      if (payForm.cuotaNumber) body.cuotaNumber = parseInt(payForm.cuotaNumber)
      if (payForm.notes.trim()) body.notes = payForm.notes.trim()
      const res  = await fetch(`/api/clients/${clientId}/payments`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); showToast('❌', d.error ?? 'Error'); return }
      const { payment } = await res.json()
      setClient(prev => prev ? { ...prev, payments: [...prev.payments, payment] } : prev)
      setPayForm({ date: new Date().toISOString().slice(0, 10), amount: '', cuotaNumber: '', notes: '' })
      showToast('✅', 'Pago registrado correctamente')
    } catch { showToast('❌', 'No se pudo conectar') }
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

  // ── Upload document ────────────────────────────────────────────────────────
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

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-500">Cargando perfil del cliente…</p>
      </div>
    </div>
  )

  if (error || !client) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">😕</p>
        <p className="text-slate-700 font-semibold mb-2">{error || 'Cliente no encontrado'}</p>
        <button onClick={onBack} className="text-sm text-blue-600 underline">← Volver a la lista</button>
      </div>
    </div>
  )

  const sCfg = STATUS_CFG[client.loanStatus]
  const cfg  = RISK_PROFILES.find(r => r.label === client.params.profile)!
  const cur  = client.params.currency
  const fmt  = (v: number) => formatCurrency(v, cur)

  const loanParams: LoanParams = {
    amount:            client.params.amount,
    termYears:         client.params.termYears,
    profile:           client.params.profile as RiskProfile,
    currency:          client.params.currency,
    rateMode:          (client.params.rateMode as RateMode) ?? 'annual',
    customMonthlyRate: client.params.customMonthlyRate ?? 0,
  }
  const riskCfg   = getRiskConfig(client.params.profile as RiskProfile)
  const amortRows = buildAmortization(loanParams)

  // ════════════════════════════════════════════════════════════════
  // EDIT MODE
  // ════════════════════════════════════════════════════════════════
  if (editMode && editForm) {
    return (
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={cancelEdit}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            style={{ background: '#e8eef7', color: '#0D2B5E' }}>
            ← Cancelar
          </button>
          <span className="text-sm font-bold" style={{ color: '#0D2B5E' }}>
            ✏️ Editando: {client.name}
          </span>
          <div className="ml-auto flex gap-3">
            <button onClick={cancelEdit}
              className="px-5 py-2.5 rounded-xl text-sm font-bold border-2 border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button onClick={saveEdit} disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
              {saving ? '⏳ Guardando...' : '💾 Guardar cambios'}
            </button>
          </div>
        </div>

        {/* Edit form card */}
        <div className="rounded-2xl p-6 bg-white border border-slate-200"
          style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>

          {/* Sección 1 — Personal */}
          <EditSectionHeader emoji="👤" title="Sección 1 — Información Personal" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <EditField label="Nombre completo *">
              <input type="text" value={editForm.name} onChange={e => sf('name')(e.target.value)}
                className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Correo electrónico">
              <input type="email" value={editForm.email} onChange={e => sf('email')(e.target.value)}
                className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Teléfono">
              <input type="text" value={editForm.phone} onChange={e => sf('phone')(e.target.value)}
                placeholder="+54 11 1234-5678" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Tipo y número de identificación">
              <div className="flex gap-2">
                <select value={editForm.idType} onChange={e => sf('idType')(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
                  style={{ color: '#374151', minWidth: '80px' }}>
                  {['DNI','CUIT','CUIL','Pasaporte','RUT','RUC','CC','NIT','Cédula'].map(t =>
                    <option key={t}>{t}</option>)}
                </select>
                <input type="text" value={editForm.idNumber} onChange={e => sf('idNumber')(e.target.value)}
                  placeholder="Número de documento" className={inputCls} style={{ color: '#374151' }} />
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

            <EditField label="Dirección actual" full>
              <input type="text" value={editForm.address} onChange={e => sf('address')(e.target.value)}
                placeholder="Calle, número, ciudad, provincia" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

          </div>

          {/* Sección 2 — Financiera */}
          <EditSectionHeader emoji="💰" title="Sección 2 — Información Financiera" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <EditField label="Ocupación / Empleador">
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
                    <span className="text-sm text-slate-700">{val ? 'Sí' : 'No'}</span>
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

          {/* Sección 3 — Garantías */}
          <EditSectionHeader emoji="🏠" title="Sección 3 — Garantías y Arraigo" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <EditField label="Colateral disponible" full>
              <input type="text" value={editForm.collateral} onChange={e => sf('collateral')(e.target.value)}
                placeholder="Ej: Inmueble valuado en USD 120.000" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Arraigo territorial" full>
              <input type="text" value={editForm.territorialTies} onChange={e => sf('territorialTies')(e.target.value)}
                placeholder="Ej: 15 años de residencia, propietario, empleo estable" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

          </div>

          {/* Sección 4 — Historial */}
          <EditSectionHeader emoji="📋" title="Sección 4 — Historial y Referencias" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <EditField label="Historial crediticio" full>
              <input type="text" value={editForm.creditHistory} onChange={e => sf('creditHistory')(e.target.value)}
                placeholder="Ej: Sin incumplimientos / Mora en 2023 saldada" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Referencia 1">
              <input type="text" value={editForm.reference1} onChange={e => sf('reference1')(e.target.value)}
                placeholder="Nombre y teléfono" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Referencia 2">
              <input type="text" value={editForm.reference2} onChange={e => sf('reference2')(e.target.value)}
                placeholder="Nombre y teléfono" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

            <EditField label="Notas del asesor" full>
              <input type="text" value={editForm.notes} onChange={e => sf('notes')(e.target.value)}
                placeholder="Observaciones adicionales" className={inputCls} style={{ color: '#374151' }} />
            </EditField>

          </div>

          {/* Bottom save row */}
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-slate-100">
            <button onClick={saveEdit} disabled={saving}
              className="px-8 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
              {saving ? '⏳ Guardando...' : '💾 Guardar cambios'}
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

  // ════════════════════════════════════════════════════════════════
  // VIEW MODE
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* ── Back + Edit buttons ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          style={{ background: '#e8eef7', color: '#0D2B5E' }}>
          ← Volver a clientes
        </button>
        <span className="text-xs text-slate-400">Perfil del cliente</span>
        <button onClick={openEdit}
          className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 border-2"
          style={{ background: '#fff', color: '#1565C0', borderColor: '#1565C0' }}>
          ✏️ Editar cliente
        </button>
      </div>

      {/* ── Hero card ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,.08)', border: `2px solid ${sCfg.border}` }}>
        <div className="h-1.5" style={{ background: `linear-gradient(90deg,${sCfg.btnBg},${sCfg.border})` }} />
        <div className="bg-white px-4 sm:px-6 py-4 sm:py-5">

          {/* Top row: avatar + name (always) + approve/deny on desktop only */}
          <div className="flex items-start gap-3 sm:gap-5">

            {/* Avatar */}
            <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg sm:text-2xl font-black text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#1565C0,#0D2B5E)' }}>
              {initials(client.name)}
            </div>

            {/* Name + badges + contact */}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-black leading-tight mb-1" style={{ color: '#0D2B5E' }}>
                {client.name}
              </h1>
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: cfg.colorBg, color: cfg.colorText }}>
                  {cfg.emoji} {cfg.label}
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: sCfg.bg, color: sCfg.color, border: `1.5px solid ${sCfg.border}` }}>
                  {sCfg.emoji} {sCfg.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs sm:text-sm text-slate-500">
                {client.email    && <span>✉️ {client.email}</span>}
                {client.phone    && <span>📞 {client.phone}</span>}
                {client.idNumber && <span>🪪 {client.idType}: {client.idNumber}</span>}
                {client.nationality && <span>🌍 {client.nationality}</span>}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Solicitud registrada el {formatDate(client.savedAt)}
              </p>
            </div>

            {/* Approve / Deny — desktop only (vertical column) */}
            <div className="hidden sm:flex flex-col gap-2 flex-shrink-0">
              <button onClick={() => updateStatus('approved')} disabled={updatingStatus}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 hover:opacity-90 active:scale-95"
                style={{
                  background: client.loanStatus === 'approved' ? '#16A34A' : '#F0FDF4',
                  color:      client.loanStatus === 'approved' ? '#fff'    : '#15803D',
                  border:     `2px solid ${client.loanStatus === 'approved' ? '#16A34A' : '#86EFAC'}`,
                }}>
                ✅ {client.loanStatus === 'approved' ? 'Aprobado ✓' : 'Aprobar'}
              </button>
              <button onClick={() => updateStatus('denied')} disabled={updatingStatus}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 hover:opacity-90 active:scale-95"
                style={{
                  background: client.loanStatus === 'denied' ? '#DC2626' : '#FFF1F2',
                  color:      client.loanStatus === 'denied' ? '#fff'    : '#DC2626',
                  border:     `2px solid ${client.loanStatus === 'denied' ? '#DC2626' : '#FECDD3'}`,
                }}>
                ❌ {client.loanStatus === 'denied' ? 'Denegado ✓' : 'Denegar'}
              </button>
              {client.loanStatus !== 'pending' && (
                <button onClick={() => updateStatus('pending')} disabled={updatingStatus}
                  className="text-xs text-slate-400 hover:text-slate-600 underline text-center disabled:opacity-40 transition-colors">
                  ↩ Restablecer
                </button>
              )}
            </div>
          </div>

          {/* Approve / Deny — mobile only (full-width row below name) */}
          <div className="sm:hidden flex gap-2 mt-3">
            <button onClick={() => updateStatus('approved')} disabled={updatingStatus}
              className="flex-1 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{
                background: client.loanStatus === 'approved' ? '#16A34A' : '#F0FDF4',
                color:      client.loanStatus === 'approved' ? '#fff'    : '#15803D',
                border:     `2px solid ${client.loanStatus === 'approved' ? '#16A34A' : '#86EFAC'}`,
              }}>
              ✅ {client.loanStatus === 'approved' ? 'Aprobado ✓' : 'Aprobar'}
            </button>
            <button onClick={() => updateStatus('denied')} disabled={updatingStatus}
              className="flex-1 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{
                background: client.loanStatus === 'denied' ? '#DC2626' : '#FFF1F2',
                color:      client.loanStatus === 'denied' ? '#fff'    : '#DC2626',
                border:     `2px solid ${client.loanStatus === 'denied' ? '#DC2626' : '#FECDD3'}`,
              }}>
              ❌ {client.loanStatus === 'denied' ? 'Denegado ✓' : 'Denegar'}
            </button>
            {client.loanStatus !== 'pending' && (
              <button onClick={() => updateStatus('pending')} disabled={updatingStatus}
                className="px-3 py-2 rounded-xl text-xs text-slate-500 border border-slate-200 bg-slate-50 disabled:opacity-40 transition-colors flex-shrink-0">
                ↩
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ── Loan summary ── */}
      <div className="rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        <div className="px-5 py-3 flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
          <span className="text-base">💳</span>
          <span className="text-xs font-bold uppercase tracking-widest text-blue-100">Simulación del Préstamo</span>
        </div>
        <div className="bg-white px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
            {[
              { label: 'Monto',     big: fmt(client.params.amount) },
              { label: 'Cuota/mes', big: fmt(client.result.monthlyPayment) },
              { label: 'Plazo',     big: `${client.params.termYears} años` },
              { label: 'Tasa',      big: formatPercent(client.result.annualRate) },
              { label: 'Total',     big: fmt(client.result.totalPayment) },
              { label: 'Intereses', big: fmt(client.result.totalInterest) },
            ].map(({ label, big }) => (
              <div key={label} className="text-center p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] sm:text-xs text-slate-400 mb-1">{label}</p>
                <p className="text-xs sm:text-sm font-black" style={{ color: '#0D2B5E' }}>{big}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap gap-3">
        <PdfExportButton params={loanParams} result={client.result} config={riskCfg} />
        <button onClick={() => setEmailOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 border-2"
          style={{ color: '#1565C0', borderColor: '#1565C0', background: '#fff' }}>
          ✉️ Enviar por email
        </button>
      </div>

      {/* ── Amortization table ── */}
      <div>
        <button onClick={() => setShowAmort(s => !s)}
          className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all mb-4"
          style={{ background: showAmort ? '#0D2B5E' : '#e8eef7', color: showAmort ? '#fff' : '#0D2B5E', border: `1px solid ${showAmort ? '#0D2B5E' : '#c5d5ea'}` }}>
          {showAmort ? '▲ Ocultar tabla de amortización' : '▼ Ver tabla de amortización'}
        </button>
        {showAmort && (
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
              <div className="flex items-center gap-2">
                <span className="text-base">📊</span>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Tabla de amortización — {client.result.totalMonths} cuotas
                </span>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: cfg.colorBg, color: cfg.colorText }}>
                {cfg.emoji} {cfg.label}
              </span>
            </div>
            <div className="p-5">
              <AmortizationTable rows={amortRows} accentColor={riskCfg.colorAccent} currency={cur} />
            </div>
          </div>
        )}
      </div>

      {/* ── Info grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SectionCard emoji="👤" title="Información Personal">
          <InfoBlock label="Fecha de nacimiento" value={client.birthDate} />
          <InfoBlock label="Nacionalidad"        value={client.nationality} />
          <InfoBlock label="Dirección"           value={client.address} />
          <InfoBlock label="Tipo de ID"          value={client.idType} />
          <InfoBlock label="Número de ID"        value={client.idNumber} />
        </SectionCard>
        <SectionCard emoji="💰" title="Información Financiera">
          <InfoBlock label="Ocupación / Empleador"      value={client.occupation} />
          <InfoBlock label="Ingresos mensuales"         value={client.monthlyIncome} />
          <InfoBlock label="Adjunta comprobantes"       value={client.hasIncomeProof} />
          <InfoBlock label="Detalle de deudas actuales" value={client.currentDebts} />
          <InfoBlock label="Valor total de deudas"      value={client.totalDebtValue} />
          <InfoBlock label="Capacidad de pago mensual"  value={client.paymentCapacity} />
        </SectionCard>
        <SectionCard emoji="🏠" title="Garantías y Arraigo">
          <InfoBlock label="Colateral disponible" value={client.collateral} />
          <InfoBlock label="Arraigo territorial"  value={client.territorialTies} />
        </SectionCard>
        <SectionCard emoji="📋" title="Historial y Referencias">
          <InfoBlock label="Historial crediticio" value={client.creditHistory} />
          <InfoBlock label="Referencia 1"         value={client.reference1} />
          <InfoBlock label="Referencia 2"         value={client.reference2} />
          <InfoBlock label="Notas del asesor"     value={client.notes} />
        </SectionCard>
      </div>

      {/* ── Pagos de cuotas ── */}
      {(() => {
        const payments = client.payments ?? []
        const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
        const totalMonths = client.result.totalMonths
        const paidCount   = payments.length
        const progress    = Math.min(100, Math.round((totalPaid / client.result.totalPayment) * 100))
        return (
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
              <span className="text-base">💵</span>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Pagos de cuotas</span>
              <span className="ml-auto text-xs text-slate-400">
                {paidCount} pago{paidCount !== 1 ? 's' : ''} registrado{paidCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="px-5 py-4 space-y-4">

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Total pagado: <span className="font-bold" style={{ color: '#0D2B5E' }}>{fmt(totalPaid)}</span></span>
                  <span>Total préstamo: <span className="font-bold" style={{ color: '#0D2B5E' }}>{fmt(client.result.totalPayment)}</span></span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, background: progress >= 100 ? '#16A34A' : 'linear-gradient(90deg,#1565C0,#0D2B5E)' }} />
                </div>
                <p className="text-xs text-slate-400 mt-1">{progress}% cubierto · {totalMonths} cuotas totales</p>
              </div>

              {/* Payment list */}
              {payments.length > 0 ? (
                <div className="space-y-2">
                  {[...payments].reverse().map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold" style={{ color: '#0D2B5E' }}>{fmt(p.amount)}</span>
                          {p.cuotaNumber && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: '#e8eef7', color: '#1565C0' }}>
                              Cuota #{p.cuotaNumber}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                          <span>📅 {formatDate(p.date)}</span>
                          {p.notes && <span>· {p.notes}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => deletePayment(p.id)}
                        disabled={deletingPayId === p.id}
                        className="text-xs text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40 flex-shrink-0"
                        title="Eliminar pago">
                        {deletingPayId === p.id ? '⏳' : '✕'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sin pagos registrados todavía.</p>
              )}

              {/* Register new payment form */}
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Registrar nuevo pago</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-xs text-slate-500 mb-1">Fecha *</label>
                    <input type="date" value={payForm.date}
                      onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full max-w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
                      style={{ color: '#374151' }} />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs text-slate-500 mb-1">Monto *</label>
                    <input type="number" min="0" step="0.01" value={payForm.amount}
                      onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder={`Ej: ${client.result.monthlyPayment.toFixed(2)}`}
                      className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
                      style={{ color: '#374151' }} />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs text-slate-500 mb-1">N.º de cuota (opcional)</label>
                    <input type="number" min="1" max={totalMonths} value={payForm.cuotaNumber}
                      onChange={e => setPayForm(f => ({ ...f, cuotaNumber: e.target.value }))}
                      placeholder={`1 – ${totalMonths}`}
                      className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
                      style={{ color: '#374151' }} />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs text-slate-500 mb-1">Notas (opcional)</label>
                    <input type="text" value={payForm.notes}
                      onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Ej: pago parcial, en efectivo…"
                      className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
                      style={{ color: '#374151' }} />
                  </div>
                </div>
                <button onClick={registerPayment} disabled={payLoading}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
                  {payLoading ? '⏳ Registrando…' : '+ Registrar pago'}
                </button>
              </div>

            </div>
          </div>
        )
      })()}

      {/* ── Documents ── */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
          <span className="text-base">📎</span>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Documentos adjuntos</span>
          <span className="ml-auto text-xs text-slate-400">
            {client.documents.length} archivo{client.documents.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="px-5 py-4">
          {client.documents.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {client.documents.map(doc => (
                <a key={doc.id}
                  href={doc.url.startsWith('data:')
                    ? doc.url
                    : `/api/blob-download?url=${encodeURIComponent(doc.url)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="group inline-flex flex-col gap-1 px-4 py-3 rounded-xl border bg-slate-50 hover:border-blue-300 hover:bg-blue-50 transition-all"
                  style={{ borderColor: '#e2e8f0', minWidth: '140px' }}>
                  <span className="text-2xl">{docIcon(doc.type)}</span>
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-700 leading-tight">{doc.name}</span>
                  <span className="text-xs text-slate-400">{(doc.size / 1024).toFixed(0)} KB · {formatDate(doc.uploadedAt)}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 mb-4">Sin documentos adjuntos todavía.</p>
          )}
          <label className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-2 border-dashed transition-all ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'}`}
            style={{ borderColor: '#c5d5ea', color: '#64748b' }}>
            <input type="file" className="hidden" disabled={uploading}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xlsx"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f); e.target.value = '' }} />
            {uploading ? '⏳ Subiendo…' : '+ Adjuntar documento'}
          </label>
          <p className="text-xs text-slate-400 mt-1.5">PDF, Word, Excel, imágenes · Máx. 10 MB</p>
        </div>
      </div>

      <div className="h-4" />

      {/* ── Modals ── */}
      <EmailModal
        isOpen={emailOpen}
        onClose={() => setEmailOpen(false)}
        params={loanParams}
        result={client.result}
        config={riskCfg}
        defaultTo={client.email ?? ''}
      />
      <ToastProvider />
    </div>
  )
}
