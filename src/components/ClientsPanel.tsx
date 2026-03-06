'use client'
import { useState, useEffect, useMemo } from 'react'
import { LoanParams, LoanResult, RiskProfile, Currency, RateMode, RISK_PROFILES, CURRENCIES, formatCurrency, formatPercent, calculateLoan } from '@/lib/loan'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientDoc {
  id: string; name: string; url: string; type: string; size: number; uploadedAt: string
}
type LoanStatus = 'pending' | 'approved' | 'denied'

interface Client {
  id: string; savedAt: string
  // Sección 1 – Información Personal
  name: string; email: string; phone: string
  idType: string; idNumber: string; birthDate: string
  nationality: string; address: string
  // Sección 2 – Información Financiera
  occupation: string; monthlyIncome: string; hasIncomeProof: boolean
  currentDebts: string; totalDebtValue: string; paymentCapacity: string
  // Sección 3 – Garantías y Arraigo
  collateral: string; territorialTies: string
  // Sección 4 – Historial y Referencias
  creditHistory: string; reference1: string; reference2: string; notes: string
  // Estado del préstamo
  loanStatus: LoanStatus
  // Préstamo
  params: LoanParams; result: LoanResult
  documents?: ClientDoc[]
}
interface Props {
  currentParams:  LoanParams
  currentResult:  LoanResult
  onLoadClient:   (params: LoanParams) => void
  onViewProfile?: (id: string) => void
}

type StorageMode = 'loading' | 'local' | 'cloud'

// ─── Empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '', email: '', phone: '',
  idType: 'DNI', idNumber: '', birthDate: '', nationality: '', address: '',
  occupation: '', monthlyIncome: '', hasIncomeProof: false,
  currentDebts: '', totalDebtValue: '', paymentCapacity: '',
  collateral: '', territorialTies: '',
  creditHistory: '', reference1: '', reference2: '', notes: '',
}
type FormData = typeof EMPTY_FORM

const LOCAL_KEY = 'jvf_clients'

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}
function docIcon(type: string) {
  return type.includes('pdf') ? '📄' : type.includes('image') ? '🖼️' : type.includes('word') ? '📝' : '📁'
}

const STATUS_CFG: Record<LoanStatus, { label: string; emoji: string; bg: string; color: string; border: string }> = {
  pending:  { label: 'Pendiente', emoji: '⏳', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  approved: { label: 'Aprobado',  emoji: '✅', bg: '#F0FDF4', color: '#14532D', border: '#86EFAC' },
  denied:   { label: 'Denegado',  emoji: '❌', bg: '#FFF1F2', color: '#881337', border: '#FECDD3' },
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mt-6 mb-4">
      <span className="text-base">{emoji}</span>
      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</span>
      <div className="flex-1 h-px bg-slate-200 ml-1" />
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors'

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientsPanel({ currentParams, currentResult, onLoadClient, onViewProfile }: Props) {
  const [clients,   setClients]  = useState<Client[]>([])
  const [mode,      setMode]     = useState<StorageMode>('loading')
  const [form,      setForm]     = useState<FormData>(EMPTY_FORM)
  const [saved,     setSaved]    = useState(false)
  const [saving,    setSaving]   = useState(false)
  const [expandId,  setExpandId] = useState<string | null>(null)
  const [search,    setSearch]   = useState('')
  const [uploading,       setUploading]      = useState<string | null>(null)
  const [updatingStatus,  setUpdatingStatus] = useState<string | null>(null)

  // ── Loan source ─────────────────────────────────────────────────────────────
  const [loanSource,        setLoanSource]        = useState<'calculator' | 'manual'>('calculator')
  const [manualAmount,      setManualAmount]      = useState(currentParams.amount)
  const [manualTermYears,   setManualTermYears]   = useState(currentParams.termYears)
  const [manualProfile,     setManualProfile]     = useState<RiskProfile>(currentParams.profile)
  const [manualCurrency,    setManualCurrency]    = useState<Currency>(currentParams.currency)
  const [manualRateMode,    setManualRateMode]    = useState<RateMode>(currentParams.rateMode ?? 'annual')
  const [manualCustomRate,  setManualCustomRate]  = useState(currentParams.customMonthlyRate ?? 0.05)

  const manualParams: LoanParams = useMemo(() => ({
    amount: manualAmount, termYears: manualTermYears, profile: manualProfile,
    currency: manualCurrency, rateMode: manualRateMode,
    customMonthlyRate: manualRateMode === 'monthly' ? manualCustomRate : undefined,
  }), [manualAmount, manualTermYears, manualProfile, manualCurrency, manualRateMode, manualCustomRate])

  const manualResult: LoanResult = useMemo(() => calculateLoan(manualParams), [manualParams])

  const activeParams = loanSource === 'calculator' ? currentParams : manualParams
  const activeResult = loanSource === 'calculator' ? currentResult : manualResult

  const filteredClients = useMemo(() =>
    clients.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase())
    ), [clients, search])

  // Handy setter: sf('name')('María')
  const sf = (k: keyof FormData) => (v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }))

  // ── Detect storage mode & load clients ─────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const res  = await fetch('/api/clients')
        const data = await res.json()
        if (res.ok && data.configured !== false) {
          setClients((data.clients ?? []).map((c: Client) => ({
            ...c,
            savedAt: c.savedAt
              ? new Date(c.savedAt).toLocaleDateString('es-AR',
                  { day: '2-digit', month: 'short', year: 'numeric' })
              : '',
          })))
          setMode('cloud')
          return
        }
      } catch { /* network unavailable */ }

      try {
        const raw = localStorage.getItem(LOCAL_KEY)
        if (raw) setClients(JSON.parse(raw))
      } catch { /* ignore */ }
      setMode('local')
    }
    init()
  }, [])

  // ── Keep localStorage in sync ──────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'local') {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(clients)) } catch { /* ignore */ }
    }
  }, [clients, mode])

  // ── Save client ────────────────────────────────────────────────────────────
  const saveClient = async () => {
    if (!form.name.trim() || saving) return
    setSaving(true)

    if (mode === 'cloud') {
      try {
        const res = await fetch('/api/clients', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ...form, params: activeParams, result: activeResult }),
        })
        if (res.ok) {
          const data   = await res.json()
          const client: Client = {
            ...form,
            id:         data.id,
            savedAt:    new Date(data.savedAt).toLocaleDateString('es-AR',
              { day: '2-digit', month: 'short', year: 'numeric' }),
            loanStatus: 'pending',
            params:     activeParams,
            result:     activeResult,
            documents:  [],
          }
          setClients(prev => [client, ...prev])
          setForm(EMPTY_FORM)
          setSaved(true); setTimeout(() => setSaved(false), 2500)
        }
      } catch (err) { console.error('Error saving client', err) }
    } else {
      const client: Client = {
        ...form,
        id:         String(Date.now()),
        savedAt:    new Date().toLocaleDateString('es-AR',
          { day: '2-digit', month: 'short', year: 'numeric' }),
        loanStatus: 'pending',
        params:     activeParams,
        result:     activeResult,
        documents:  [],
      }
      setClients(prev => [client, ...prev])
      setForm(EMPTY_FORM)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  // ── Remove client ──────────────────────────────────────────────────────────
  const removeClient = async (id: string) => {
    if (mode === 'cloud') {
      await fetch(`/api/clients/${id}`, { method: 'DELETE' }).catch(() => {})
    }
    setClients(prev => prev.filter(c => c.id !== id))
  }

  // ── Upload document ────────────────────────────────────────────────────────
  const uploadDoc = async (clientId: string, file: File) => {
    setUploading(clientId)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, { method: 'POST', body: fd })
      if (res.ok) {
        const { document } = await res.json()
        setClients(prev => prev.map(c =>
          c.id === clientId ? { ...c, documents: [...(c.documents ?? []), document] } : c
        ))
      }
    } finally { setUploading(null) }
  }

  // ── Update loan status ─────────────────────────────────────────────────────
  const updateStatus = async (id: string, next: LoanStatus) => {
    // Toggle back to pending if clicking the already-active status
    const target = clients.find(c => c.id === id)?.loanStatus === next ? 'pending' : next
    setUpdatingStatus(id)
    if (mode === 'cloud') {
      try {
        await fetch(`/api/clients/${id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ loanStatus: target }),
        })
      } catch (err) { console.error('Error updating status', err) }
    }
    setClients(prev => prev.map(c => c.id === id ? { ...c, loanStatus: target } : c))
    setUpdatingStatus(null)
  }

  const fmt = (v: number, cur: Currency) => formatCurrency(v, cur)

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Storage mode banner */}
      {mode !== 'loading' && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border"
          style={{
            background:  mode === 'cloud' ? '#E8F5E9' : '#FFF8E1',
            borderColor: mode === 'cloud' ? '#2E7D3233' : '#F59E0B33',
            color:       mode === 'cloud' ? '#1B5E20'  : '#6D4C00',
          }}>
          {mode === 'cloud'
            ? '☁️  Conectado a MongoDB — datos sincronizados en la nube'
            : '💾  Guardado localmente — configurá MongoDB para sincronización en la nube'}
        </div>
      )}

      {/* ── New-client form ── */}
      <div className="rounded-2xl p-4 sm:p-6 bg-white border border-slate-200"
        style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-1 h-6 rounded-full"
            style={{ background: 'linear-gradient(180deg,#1565C0,#0D2B5E)' }} />
          <h2 className="font-display text-base" style={{ color: '#0D2B5E' }}>
            Solicitud de Crédito — JVF Inversiones SRL
          </h2>
        </div>

        {/* Loan source toggle */}
        <div className="flex gap-2 mb-4">
          {(['calculator', 'manual'] as const).map(src => (
            <button key={src} onClick={() => setLoanSource(src)}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-all border-2"
              style={{
                background:   loanSource === src ? '#0D2B5E' : '#f8fafc',
                color:        loanSource === src ? '#fff'     : '#64748b',
                borderColor:  loanSource === src ? '#0D2B5E' : '#e2e8f0',
              }}>
              {src === 'calculator' ? '🧮 Usar datos de calculadora' : '✏️ Configurar manualmente'}
            </button>
          ))}
        </div>

        {/* Calculator summary */}
        {loanSource === 'calculator' && (
          <div className="rounded-xl p-4 mb-4 border border-slate-200 bg-slate-50 text-xs flex flex-wrap gap-4">
            {[
              ['Monto',     fmt(currentParams.amount, currentParams.currency)],
              ['Plazo',     `${currentParams.termYears} años`],
              ['Perfil',    `${RISK_PROFILES.find(r => r.label === currentParams.profile)?.emoji} ${currentParams.profile}`],
              ['Cuota/mes', fmt(currentResult.monthlyPayment, currentParams.currency)],
            ].map(([l, v]) => (
              <div key={l}>
                <span className="text-slate-400 mr-1">{l}:</span>
                <span className="font-bold" style={{ color: '#0D2B5E' }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Manual loan config */}
        {loanSource === 'manual' && (
          <div className="rounded-xl p-4 mb-4 border-2 border-slate-200 bg-slate-50 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Monto</label>
                <input type="number" min={0} value={manualAmount}
                  onChange={e => setManualAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white"
                  style={{ color: '#374151' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Plazo (años)</label>
                <input type="number" min={1} max={30} value={manualTermYears}
                  onChange={e => setManualTermYears(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white"
                  style={{ color: '#374151' }} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Moneda</label>
              <div className="flex gap-2 flex-wrap">
                {(Object.values(CURRENCIES)).map(c => (
                  <button key={c.code} onClick={() => setManualCurrency(c.code)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all"
                    style={{
                      background:  manualCurrency === c.code ? '#0D2B5E' : '#fff',
                      color:       manualCurrency === c.code ? '#fff'     : '#64748b',
                      borderColor: manualCurrency === c.code ? '#0D2B5E' : '#e2e8f0',
                    }}>
                    {c.flag} {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Perfil de riesgo</label>
              <div className="flex gap-2 flex-wrap">
                {RISK_PROFILES.map(r => (
                  <button key={r.label} onClick={() => setManualProfile(r.label as RiskProfile)}
                    className="flex-1 min-w-[90px] px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all"
                    style={{
                      background:  manualProfile === r.label ? r.colorBg   : '#fff',
                      color:       manualProfile === r.label ? r.colorText  : '#64748b',
                      borderColor: manualProfile === r.label ? r.colorAccent : '#e2e8f0',
                    }}>
                    {r.emoji} {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Modo de tasa</label>
              <div className="flex gap-2 mb-2">
                {(['annual', 'monthly'] as RateMode[]).map(m => (
                  <button key={m} onClick={() => setManualRateMode(m)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all"
                    style={{
                      background:  manualRateMode === m ? '#0D2B5E' : '#fff',
                      color:       manualRateMode === m ? '#fff'     : '#64748b',
                      borderColor: manualRateMode === m ? '#0D2B5E' : '#e2e8f0',
                    }}>
                    {m === 'annual' ? 'Tasa anual (perfil)' : 'Tasa mensual personalizada'}
                  </button>
                ))}
              </div>
              {manualRateMode === 'monthly' && (
                <div className="flex items-center gap-2">
                  <input type="number" min={0.1} max={100} step={0.1}
                    value={(manualCustomRate * 100).toFixed(2)}
                    onChange={e => setManualCustomRate(Number(e.target.value) / 100)}
                    className="w-28 px-3 py-2 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
                    style={{ color: '#374151' }} />
                  <span className="text-xs text-slate-500">% mensual</span>
                </div>
              )}
            </div>

            {/* Live computed preview */}
            <div className="flex flex-wrap gap-4 pt-3 border-t border-slate-200 text-xs">
              {[
                ['Cuota/mes', fmt(manualResult.monthlyPayment, manualCurrency)],
                ['Total',     fmt(manualResult.totalPayment, manualCurrency)],
                ['Intereses', fmt(manualResult.totalInterest, manualCurrency)],
                ['Tasa anual', formatPercent(manualResult.annualRate)],
              ].map(([l, v]) => (
                <div key={l}>
                  <span className="text-slate-400 mr-1">{l}:</span>
                  <span className="font-bold" style={{ color: '#0D2B5E' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Sección 1: Información Personal ── */}
        <SectionHeader emoji="👤" title="Sección 1 — Información Personal" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <Field label="Nombre completo del solicitante *">
            <input type="text" value={form.name} onChange={e => sf('name')(e.target.value)}
              placeholder="Ej: María García" className={inputCls} style={{ color: '#374151' }} />
          </Field>

          <Field label="Correo electrónico">
            <input type="email" value={form.email} onChange={e => sf('email')(e.target.value)}
              placeholder="cliente@email.com" className={inputCls} style={{ color: '#374151' }} />
          </Field>

          <Field label="Número de teléfono">
            <input type="text" value={form.phone} onChange={e => sf('phone')(e.target.value)}
              placeholder="+54 11 1234-5678" className={inputCls} style={{ color: '#374151' }} />
          </Field>

          {/* Tipo y número de identificación */}
          <Field label="Tipo y número de identificación">
            <div className="flex gap-2">
              <select value={form.idType} onChange={e => sf('idType')(e.target.value)}
                className="px-3 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white"
                style={{ color: '#374151', minWidth: '80px' }}>
                {['DNI','CUIT','CUIL','Pasaporte','RUT','RUC','CC','NIT'].map(t =>
                  <option key={t}>{t}</option>)}
              </select>
              <input type="text" value={form.idNumber} onChange={e => sf('idNumber')(e.target.value)}
                placeholder="Número de documento" className={inputCls} style={{ color: '#374151' }} />
            </div>
          </Field>

          <Field label="Fecha de nacimiento">
            <input type="date" value={form.birthDate} onChange={e => sf('birthDate')(e.target.value)}
              className={inputCls} style={{ color: '#374151' }} />
          </Field>

          <Field label="Nacionalidad">
            <input type="text" value={form.nationality} onChange={e => sf('nationality')(e.target.value)}
              placeholder="Ej: Argentina" className={inputCls} style={{ color: '#374151' }} />
          </Field>

          <Field label="Dirección actual (domicilio)" full>
            <input type="text" value={form.address} onChange={e => sf('address')(e.target.value)}
              placeholder="Calle, número, ciudad, provincia" className={inputCls} style={{ color: '#374151' }} />
          </Field>

        </div>

        {/* ── Sección 2: Información Financiera ── */}
        <SectionHeader emoji="💰" title="Sección 2 — Información Financiera" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <Field label="Ocupación / Empleador">
            <input type="text" value={form.occupation} onChange={e => sf('occupation')(e.target.value)}
              placeholder="Ej: Contador en Empresa SA" className={inputCls} style={{ color: '#374151' }} />
          </Field>

          <Field label="Ingresos mensuales (indicar moneda)">
            <input type="text" value={form.monthlyIncome} onChange={e => sf('monthlyIncome')(e.target.value)}
              placeholder="Ej: ARS 450.000 / USD 2.000" className={inputCls} style={{ color: '#374151' }} />
          </Field>

          {/* Checkbox comprobantes */}
          <Field label="Adjunta comprobantes de ingresos">
            <div className="flex items-center gap-3 h-[46px] px-4 rounded-xl border-2 border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="incomeProof" checked={form.hasIncomeProof === true}
                  onChange={() => sf('hasIncomeProof')(true)}
                  className="accent-blue-600" />
                <span className="text-sm text-slate-700">Sí</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="incomeProof" checked={form.hasIncomeProof === false}
                  onChange={() => sf('hasIncomeProof')(false)}
                  className="accent-blue-600" />
                <span className="text-sm text-slate-700">No</span>
              </label>
            </div>
          </Field>

          <Field label="Valor total de deudas actuales">
            <input type="text" value={form.totalDebtValue} onChange={e => sf('totalDebtValue')(e.target.value)}
              placeholder="Ej: ARS 200.000" className={inputCls} style={{ color: '#374151' }} />
          </Field>

          <Field label="Detalle de deudas actuales (entidades y montos)" full>
            <input type="text" value={form.currentDebts} onChange={e => sf('currentDebts')(e.target.value)}
              placeholder="Ej: Banco Nación — $80.000 / Tarjeta Visa — $120.000" className={inputCls} style={{ color: '#374151' }} />
          </Field>

          <Field label="Capacidad de pago mensual estimada" full>
            <input type="text" value={form.paymentCapacity} onChange={e => sf('paymentCapacity')(e.target.value)}
              placeholder="Ej: ARS 150.000 / mes" className={inputCls} style={{ color: '#374151' }} />
          </Field>

        </div>

        {/* ── Sección 3: Garantías y Arraigo ── */}
        <SectionHeader emoji="🏠" title="Sección 3 — Garantías y Arraigo" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <Field label="Descripción del colateral disponible (tipo y valor aprox.)" full>
            <input type="text" value={form.collateral} onChange={e => sf('collateral')(e.target.value)}
              placeholder="Ej: Inmueble en Buenos Aires valuado en USD 120.000" className={inputCls} style={{ color: '#374151' }} />
          </Field>

          <Field label="Arraigo territorial (familia, propiedad, residencia, empleo)" full>
            <input type="text" value={form.territorialTies} onChange={e => sf('territorialTies')(e.target.value)}
              placeholder="Ej: 15 años de residencia, propietario, dos hijos, empleo estable" className={inputCls} style={{ color: '#374151' }} />
          </Field>

        </div>

        {/* ── Sección 4: Historial y Referencias ── */}
        <SectionHeader emoji="📋" title="Sección 4 — Historial y Referencias" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <Field label="Historial crediticio (incumplimientos recientes, si aplica)" full>
            <input type="text" value={form.creditHistory} onChange={e => sf('creditHistory')(e.target.value)}
              placeholder="Ej: Sin incumplimientos / 1 mora en 2023 por $15.000 saldada" className={inputCls} style={{ color: '#374151' }} />
          </Field>

          <Field label="Contacto de referencia 1 (nombre y teléfono)">
            <input type="text" value={form.reference1} onChange={e => sf('reference1')(e.target.value)}
              placeholder="Ej: Juan López — +54 11 5555-1234" className={inputCls} style={{ color: '#374151' }} />
          </Field>

          <Field label="Contacto de referencia 2 (nombre y teléfono)">
            <input type="text" value={form.reference2} onChange={e => sf('reference2')(e.target.value)}
              placeholder="Ej: Ana Torres — +54 11 6666-5678" className={inputCls} style={{ color: '#374151' }} />
          </Field>

          <Field label="Notas u observaciones adicionales" full>
            <input type="text" value={form.notes} onChange={e => sf('notes')(e.target.value)}
              placeholder="Observaciones adicionales del asesor" className={inputCls} style={{ color: '#374151' }} />
          </Field>

        </div>

        {/* ── Submit ── */}
        <div className="flex items-center gap-3 mt-6 pt-5 border-t border-slate-100">
          <button onClick={saveClient} disabled={!form.name.trim() || saving}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
            {saving ? '⏳ Guardando...' : '💾 Guardar solicitud'}
          </button>
          {saved && <span className="text-sm font-semibold text-green-600">✅ Solicitud guardada</span>}
        </div>
      </div>

      {/* ── Search bar above client list ── */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none select-none">🔍</span>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente por nombre o email..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white"
          style={{ color: '#374151', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }} />
      </div>

      {/* ── Client list ── */}
      <div className="rounded-2xl p-4 sm:p-6 bg-white border border-slate-200"
        style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-1 h-6 rounded-full"
            style={{ background: 'linear-gradient(180deg,#1565C0,#0D2B5E)' }} />
          <h2 className="font-display text-base" style={{ color: '#0D2B5E' }}>Clientes guardados</h2>
          <span className="ml-auto text-xs text-slate-400">
            {search ? `${filteredClients.length} de ${clients.length}` : `${clients.length}`} clientes
          </span>
        </div>

        {/* Status summary pills */}
        {clients.length > 0 && (() => {
          const counts = { pending: 0, approved: 0, denied: 0 }
          clients.forEach(c => { counts[c.loanStatus ?? 'pending']++ })
          return (
            <div className="flex gap-2 flex-wrap mb-4">
              {(['pending', 'approved', 'denied'] as LoanStatus[]).map(s => (
                <span key={s} className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: STATUS_CFG[s].bg, color: STATUS_CFG[s].color, border: `1px solid ${STATUS_CFG[s].border}` }}>
                  {STATUS_CFG[s].emoji} {STATUS_CFG[s].label}: {counts[s]}
                </span>
              ))}
            </div>
          )
        })()}

        {clients.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-sm">No hay clientes guardados aún.</p>
            <p className="text-xs mt-1">Completa el formulario arriba para comenzar.</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm">Sin resultados para <strong>&ldquo;{search}&rdquo;</strong></p>
            <button onClick={() => setSearch('')}
              className="text-xs mt-2 underline hover:text-blue-500 transition-colors">
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClients.map(c => {
              const cfg = RISK_PROFILES.find(r => r.label === c.params.profile)!
              const cur: Currency = c.params.currency
              const isExpanded = expandId === c.id

              const sCfg = STATUS_CFG[c.loanStatus ?? 'pending']
              const isBusy = updatingStatus === c.id

              return (
                <div key={c.id} className="rounded-xl overflow-hidden transition-all"
                  style={{ border: `1.5px solid ${sCfg.border}` }}>

                  {/* Status accent bar */}
                  <div className="h-1 w-full" style={{ background: sCfg.border }} />

                  {/* Card body */}
                  <div className="p-3 sm:p-4 bg-white">

                    {/* Top: avatar + info + badges */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#1565C0,#0D2B5E)' }}>
                        {initials(c.name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold leading-tight" style={{ color: '#0D2B5E' }}>{c.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          <strong>{fmt(c.params.amount, cur)}</strong> · {c.params.termYears} años ·
                          <strong> {fmt(c.result.monthlyPayment, cur)}/mes</strong>
                        </p>
                        {c.email && <p className="text-xs text-slate-400 mt-0.5 truncate">{c.email}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">
                          {c.savedAt}
                          {c.documents && c.documents.length > 0 && (
                            <span className="ml-1.5 text-blue-500 font-semibold">
                              📎 {c.documents.length}
                            </span>
                          )}
                        </p>
                        {/* Badges */}
                        <div className="flex gap-1.5 flex-wrap mt-1.5">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: cfg.colorBg, color: cfg.colorText }}>
                            {cfg.emoji} {cfg.label}
                          </span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: sCfg.bg, color: sCfg.color, border: `1px solid ${sCfg.border}` }}>
                            {sCfg.emoji} {sCfg.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons row */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => updateStatus(c.id, 'approved')}
                        disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                        style={{
                          background: c.loanStatus === 'approved' ? '#16A34A' : '#F0FDF4',
                          color:      c.loanStatus === 'approved' ? '#fff'    : '#15803D',
                          border:     `1.5px solid ${c.loanStatus === 'approved' ? '#16A34A' : '#86EFAC'}`,
                        }}>
                        ✅ Aprobar
                      </button>
                      <button
                        onClick={() => updateStatus(c.id, 'denied')}
                        disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                        style={{
                          background: c.loanStatus === 'denied' ? '#DC2626' : '#FFF1F2',
                          color:      c.loanStatus === 'denied' ? '#fff'    : '#DC2626',
                          border:     `1.5px solid ${c.loanStatus === 'denied' ? '#DC2626' : '#FECDD3'}`,
                        }}>
                        ❌ Denegar
                      </button>
                      <button onClick={() => onViewProfile?.(c.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{ background: '#0D2B5E', color: '#fff' }}>
                        👤 Perfil
                      </button>
                      <button onClick={() => onLoadClient(c.params)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{ background: '#e8eef7', color: '#0D2B5E' }}>
                        📂 Cargar
                      </button>
                      {mode === 'cloud' && (
                        <button onClick={() => setExpandId(isExpanded ? null : c.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          style={{ background: isExpanded ? '#0D2B5E' : '#e8eef7',
                                   color:      isExpanded ? '#fff'    : '#1565C0' }}>
                          📎 Docs
                        </button>
                      )}
                      <button onClick={() => removeClient(c.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Expanded panel: details + documents */}
                  {isExpanded && mode === 'cloud' && (
                    <div className="border-t px-4 pb-5 pt-4 space-y-4"
                      style={{ background: sCfg.bg, borderColor: sCfg.border }}>

                      {/* Status decision row */}
                      <div className="flex items-center gap-3 pb-3 border-b flex-wrap" style={{ borderColor: sCfg.border }}>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Decisión de crédito:
                        </span>
                        <span className="text-sm font-bold px-3 py-1 rounded-full"
                          style={{ background: sCfg.border, color: sCfg.color }}>
                          {sCfg.emoji} {sCfg.label}
                        </span>
                        {c.loanStatus !== 'pending' && (
                          <button
                            onClick={() => updateStatus(c.id, 'pending')}
                            disabled={isBusy}
                            className="text-xs text-slate-400 hover:text-slate-600 underline disabled:opacity-40 transition-colors">
                            ↩ Restablecer a pendiente
                          </button>
                        )}
                      </div>

                      {/* Client details grid */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                          Datos del solicitante
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                          {[
                            ['Teléfono',        c.phone],
                            ['ID',              c.idNumber ? `${c.idType} ${c.idNumber}` : ''],
                            ['Nacimiento',      c.birthDate],
                            ['Nacionalidad',    c.nationality],
                            ['Dirección',       c.address],
                            ['Ocupación',       c.occupation],
                            ['Ingresos',        c.monthlyIncome],
                            ['Comprobantes',    c.hasIncomeProof ? 'Sí' : 'No'],
                            ['Deudas',          c.currentDebts],
                            ['Total deudas',    c.totalDebtValue],
                            ['Cap. de pago',    c.paymentCapacity],
                            ['Colateral',       c.collateral],
                            ['Arraigo',         c.territorialTies],
                            ['Hist. crediticio',c.creditHistory],
                            ['Referencia 1',    c.reference1],
                            ['Referencia 2',    c.reference2],
                            ['Notas',           c.notes],
                          ].filter(([, v]) => v).map(([l, v]) => (
                            <div key={l}>
                              <span className="text-slate-400">{l}: </span>
                              <span className="text-slate-700 font-medium">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Documents */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Documentos adjuntos
                        </p>
                        {c.documents && c.documents.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {c.documents.map(doc => (
                              <a key={doc.id}
                                href={doc.url.startsWith('data:')
                                  ? doc.url
                                  : `/api/blob-download?url=${encodeURIComponent(doc.url)}`}
                                target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white hover:border-blue-300 hover:bg-blue-50 transition-all"
                                style={{ color: '#0D2B5E', borderColor: '#e2e8f0' }}>
                                {docIcon(doc.type)} {doc.name}
                                <span className="text-slate-400 font-normal">
                                  ({(doc.size / 1024).toFixed(0)} KB)
                                </span>
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 mb-3">Sin documentos adjuntos todavía.</p>
                        )}

                        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer border-2 border-dashed transition-all ${uploading === c.id ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 hover:text-blue-600'}`}
                          style={{ borderColor: '#c5d5ea', color: '#64748b' }}>
                          <input type="file" className="hidden" disabled={uploading === c.id}
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xlsx"
                            onChange={e => {
                              const f = e.target.files?.[0]
                              if (f) uploadDoc(c.id, f)
                              e.target.value = ''
                            }} />
                          {uploading === c.id ? '⏳ Subiendo...' : '+ Adjuntar documento'}
                        </label>
                        <p className="text-xs text-slate-400 mt-1.5">
                          PDF, Word, Excel, imágenes · Máx. 10 MB
                        </p>
                      </div>

                    </div>
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
