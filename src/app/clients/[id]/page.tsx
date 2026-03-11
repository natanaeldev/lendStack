'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatPercent, RISK_PROFILES, Currency, buildAmortization, getRiskConfig, LoanParams, RateMode, RiskProfile, Branch } from '@/lib/loan'
import LendStackLogo    from '@/components/LendStackLogo'
import AmortizationTable from '@/components/AmortizationTable'
import PdfExportButton  from '@/components/PdfExport'
import EmailModal       from '@/components/EmailModal'
import ToastProvider    from '@/components/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type LoanStatus = 'pending' | 'approved' | 'denied'

interface ClientDoc {
  id: string; name: string; url: string; type: string; size: number; uploadedAt: string
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
  branch: Branch | null
  branchId: string | null
  branchName: string | null
  params: { amount: number; termYears: number; profile: string; currency: Currency; rateMode: string; customMonthlyRate: number }
  result: { monthlyPayment: number; totalPayment: number; totalInterest: number; annualRate: number; monthlyRate: number; totalMonths: number; interestRatio: number }
  documents: ClientDoc[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<LoanStatus, { label: string; emoji: string; bg: string; color: string; border: string; btnBg: string }> = {
  pending:  { label: 'Pendiente', emoji: '⏳', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', btnBg: '#F59E0B' },
  approved: { label: 'Aprobado',  emoji: '✅', bg: '#F0FDF4', color: '#14532D', border: '#86EFAC', btnBg: '#16A34A' },
  denied:   { label: 'Denegado',  emoji: '❌', bg: '#FFF1F2', color: '#881337', border: '#FECDD3', btnBg: '#DC2626' },
}

const BRANCH_CFG: Record<Branch, { label: string; emoji: string; bg: string; color: string; border: string }> = {
  sede:  { label: 'Sede',  emoji: '🏢', bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  rutas: { label: 'Rutas', emoji: '🛵', bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA' },
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}
function docIcon(type: string) {
  return type.includes('pdf') ? '📄' : type.includes('image') ? '🖼️' : type.includes('word') ? '📝' : '📁'
}
function formatDate(iso: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientProfilePage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()

  const [client,         setClient]        = useState<ClientProfile | null>(null)
  const [loading,        setLoading]       = useState(true)
  const [error,          setError]         = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [uploading,      setUploading]     = useState(false)
  const [emailOpen,      setEmailOpen]     = useState(false)
  const [showAmort,      setShowAmort]     = useState(false)

  // ── Fetch client ───────────────────────────────────────────────────────────
  const loadClient = useCallback(async () => {
    try {
      const res  = await fetch(`/api/clients/${id}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al cargar el cliente'); return }
      setClient(data.client)
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadClient() }, [loadClient])

  // ── Update status ──────────────────────────────────────────────────────────
  const updateStatus = async (next: LoanStatus) => {
    if (!client || updatingStatus) return
    const target = client.loanStatus === next ? 'pending' : next
    setUpdatingStatus(true)
    try {
      await fetch(`/api/clients/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ loanStatus: target }),
      })
      setClient(prev => prev ? { ...prev, loanStatus: target } : prev)
    } catch { /* silent */ }
    setUpdatingStatus(false)
  }

  // ── Upload document ────────────────────────────────────────────────────────
  const uploadDoc = async (file: File) => {
    if (!client) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`/api/clients/${id}/documents`, { method: 'POST', body: fd })
      if (res.ok) {
        const { document } = await res.json()
        setClient(prev => prev ? { ...prev, documents: [...prev.documents, document] } : prev)
      }
    } finally { setUploading(false) }
  }

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-500">Cargando perfil del cliente…</p>
      </div>
    </div>
  )

  if (error || !client) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">😕</p>
        <p className="text-slate-700 font-semibold mb-2">{error || 'Cliente no encontrado'}</p>
        <Link href="/app" className="text-sm text-blue-600 underline">← Volver a la aplicación</Link>
      </div>
    </div>
  )

  const sCfg = STATUS_CFG[client.loanStatus]
  const cfg  = RISK_PROFILES.find(r => r.label === client.params.profile)!
  const cur  = client.params.currency

  const fmt  = (v: number) => formatCurrency(v, cur)

  // Build typed loan objects for PDF / email / amortization table
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

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3"
        style={{ boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          ← Volver
        </button>
        <div className="flex-1" />
        {/* LendStack brand */}
        <LendStackLogo variant="dark" size={30} />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ── Hero card ── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,.08)', border: `2px solid ${sCfg.border}` }}>

          {/* Status accent stripe */}
          <div className="h-1.5" style={{ background: `linear-gradient(90deg,${sCfg.btnBg},${sCfg.border})` }} />

          <div className="bg-white px-6 py-5">
            <div className="flex items-start gap-5 flex-wrap">

              {/* Avatar */}
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#1565C0,#0D2B5E)' }}>
                {initials(client.name)}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h1 className="text-2xl font-black" style={{ color: '#0D2B5E' }}>{client.name}</h1>
                  {/* Risk badge */}
                  <span className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: cfg.colorBg, color: cfg.colorText }}>
                    {cfg.emoji} {cfg.label}
                  </span>
                  {/* Branch badge */}
                  {client.branch && BRANCH_CFG[client.branch] && (
                    <span className="text-xs font-bold px-3 py-1 rounded-full"
                      style={{ background: BRANCH_CFG[client.branch].bg, color: BRANCH_CFG[client.branch].color, border: `1.5px solid ${BRANCH_CFG[client.branch].border}` }}>
                      {BRANCH_CFG[client.branch].emoji} {client.branchName ?? BRANCH_CFG[client.branch].label}
                    </span>
                  )}
                  {/* Status badge */}
                  <span className="text-sm font-bold px-3 py-1.5 rounded-full"
                    style={{ background: sCfg.bg, color: sCfg.color, border: `1.5px solid ${sCfg.border}` }}>
                    {sCfg.emoji} {sCfg.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
                  {client.email && <span>✉️ {client.email}</span>}
                  {client.phone && <span>📞 {client.phone}</span>}
                  {client.idNumber && <span>🪪 {client.idType}: {client.idNumber}</span>}
                  {client.nationality && <span>🌍 {client.nationality}</span>}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Solicitud registrada el {formatDate(client.savedAt)}
                </p>
              </div>

              {/* Approve / Deny buttons */}
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => updateStatus('approved')}
                  disabled={updatingStatus}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 hover:opacity-90 active:scale-95"
                  style={{
                    background: client.loanStatus === 'approved' ? '#16A34A' : '#F0FDF4',
                    color:      client.loanStatus === 'approved' ? '#fff'    : '#15803D',
                    border:     `2px solid ${client.loanStatus === 'approved' ? '#16A34A' : '#86EFAC'}`,
                  }}>
                  ✅ {client.loanStatus === 'approved' ? 'Aprobado ✓' : 'Aprobar'}
                </button>
                <button
                  onClick={() => updateStatus('denied')}
                  disabled={updatingStatus}
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
          </div>
        </div>

        {/* ── Loan summary ── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
          <div className="px-5 py-3 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
            <span className="text-base">💳</span>
            <span className="text-xs font-bold uppercase tracking-widest text-blue-100">
              Simulación del Préstamo
            </span>
          </div>
          <div className="bg-white px-5 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Monto solicitado',  value: fmt(client.result.monthlyPayment !== 0 ? client.params.amount : 0),
                  big: fmt(client.params.amount) },
                { label: 'Cuota mensual',     big: fmt(client.result.monthlyPayment) },
                { label: 'Plazo',             big: `${client.params.termYears} años` },
                { label: 'Tasa anual',        big: formatPercent(client.result.annualRate) },
                { label: 'Total a pagar',     big: fmt(client.result.totalPayment) },
                { label: 'Total intereses',   big: fmt(client.result.totalInterest) },
              ].map(({ label, big }) => (
                <div key={label} className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">{label}</p>
                  <p className="text-sm font-black" style={{ color: '#0D2B5E' }}>{big}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex flex-wrap gap-3">
          <PdfExportButton params={loanParams} result={client.result} config={riskCfg} />
          <button
            onClick={() => setEmailOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 border-2"
            style={{ color: '#1565C0', borderColor: '#1565C0', background: '#fff' }}>
            ✉️ Enviar por email
          </button>
        </div>

        {/* ── Amortization table ── */}
        <div>
          <button
            onClick={() => setShowAmort(s => !s)}
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

          {/* Personal */}
          <SectionCard emoji="👤" title="Información Personal">
            <InfoBlock label="Fecha de nacimiento"  value={client.birthDate} />
            <InfoBlock label="Nacionalidad"         value={client.nationality} />
            <InfoBlock label="Dirección"            value={client.address} />
            <InfoBlock label="Tipo de ID"           value={client.idType} />
            <InfoBlock label="Número de ID"         value={client.idNumber} />
          </SectionCard>

          {/* Financial */}
          <SectionCard emoji="💰" title="Información Financiera">
            <InfoBlock label="Ocupación / Empleador"       value={client.occupation} />
            <InfoBlock label="Ingresos mensuales"          value={client.monthlyIncome} />
            <InfoBlock label="Adjunta comprobantes"        value={client.hasIncomeProof} />
            <InfoBlock label="Detalle de deudas actuales"  value={client.currentDebts} />
            <InfoBlock label="Valor total de deudas"       value={client.totalDebtValue} />
            <InfoBlock label="Capacidad de pago mensual"   value={client.paymentCapacity} />
          </SectionCard>

          {/* Collateral */}
          <SectionCard emoji="🏠" title="Garantías y Arraigo">
            <InfoBlock label="Colateral disponible" value={client.collateral} />
            <InfoBlock label="Arraigo territorial"  value={client.territorialTies} />
          </SectionCard>

          {/* History */}
          <SectionCard emoji="📋" title="Historial y Referencias">
            <InfoBlock label="Historial crediticio" value={client.creditHistory} />
            <InfoBlock label="Referencia 1"         value={client.reference1} />
            <InfoBlock label="Referencia 2"         value={client.reference2} />
            <InfoBlock label="Notas del asesor"     value={client.notes} />
          </SectionCard>

        </div>

        {/* ── Documents ── */}
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
          style={{ boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
            <span className="text-base">📎</span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Documentos adjuntos
            </span>
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
                      : `/api/clients/${id}/documents/${doc.id}/presign`}
                    target="_blank" rel="noopener noreferrer"
                    className="group inline-flex flex-col gap-1 px-4 py-3 rounded-xl border bg-slate-50 hover:border-blue-300 hover:bg-blue-50 transition-all"
                    style={{ borderColor: '#e2e8f0', minWidth: '140px' }}>
                    <span className="text-2xl">{docIcon(doc.type)}</span>
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-700 leading-tight">
                      {doc.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {(doc.size / 1024).toFixed(0)} KB · {formatDate(doc.uploadedAt)}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 mb-4">Sin documentos adjuntos todavía.</p>
            )}

            {/* Upload */}
            <label className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-2 border-dashed transition-all ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'}`}
              style={{ borderColor: '#c5d5ea', color: '#64748b' }}>
              <input type="file" className="hidden" disabled={uploading}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xlsx"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) uploadDoc(f)
                  e.target.value = ''
                }} />
              {uploading ? '⏳ Subiendo…' : '+ Adjuntar documento'}
            </label>
            <p className="text-xs text-slate-400 mt-1.5">PDF, Word, Excel, imágenes · Máx. 10 MB</p>
          </div>
        </div>

        {/* Bottom padding */}
        <div className="h-6" />
      </div>

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
