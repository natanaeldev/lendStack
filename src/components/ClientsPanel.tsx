'use client'
import { useState, useEffect } from 'react'
import { LoanParams, LoanResult, RiskProfile, Currency, RISK_PROFILES, formatCurrency } from '@/lib/loan'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientDoc {
  id: string; name: string; url: string; type: string; size: number; uploadedAt: string
}
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
  // Préstamo
  params: LoanParams; result: LoanResult
  documents?: ClientDoc[]
}
interface Props {
  currentParams: LoanParams
  currentResult: LoanResult
  onLoadClient:  (params: LoanParams) => void
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

export default function ClientsPanel({ currentParams, currentResult, onLoadClient }: Props) {
  const [clients,   setClients]  = useState<Client[]>([])
  const [mode,      setMode]     = useState<StorageMode>('loading')
  const [form,      setForm]     = useState<FormData>(EMPTY_FORM)
  const [saved,     setSaved]    = useState(false)
  const [saving,    setSaving]   = useState(false)
  const [expandId,  setExpandId] = useState<string | null>(null)
  const [uploading, setUploading]= useState<string | null>(null)

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
          body:    JSON.stringify({ ...form, params: currentParams, result: currentResult }),
        })
        if (res.ok) {
          const data   = await res.json()
          const client: Client = {
            ...form,
            id:      data.id,
            savedAt: new Date(data.savedAt).toLocaleDateString('es-AR',
              { day: '2-digit', month: 'short', year: 'numeric' }),
            params:    currentParams,
            result:    currentResult,
            documents: [],
          }
          setClients(prev => [client, ...prev])
          setForm(EMPTY_FORM)
          setSaved(true); setTimeout(() => setSaved(false), 2500)
        }
      } catch (err) { console.error('Error saving client', err) }
    } else {
      const client: Client = {
        ...form,
        id:      String(Date.now()),
        savedAt: new Date().toLocaleDateString('es-AR',
          { day: '2-digit', month: 'short', year: 'numeric' }),
        params:    currentParams,
        result:    currentResult,
        documents: [],
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
      <div className="rounded-2xl p-6 bg-white border border-slate-200"
        style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-1 h-6 rounded-full"
            style={{ background: 'linear-gradient(180deg,#1565C0,#0D2B5E)' }} />
          <h2 className="font-display text-base" style={{ color: '#0D2B5E' }}>
            Solicitud de Crédito — JVF Inversiones SRL
          </h2>
        </div>

        {/* Current simulation summary */}
        <div className="rounded-xl p-4 mb-2 border border-slate-200 bg-slate-50 text-xs flex flex-wrap gap-4">
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

      {/* ── Client list ── */}
      <div className="rounded-2xl p-6 bg-white border border-slate-200"
        style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-1 h-6 rounded-full"
            style={{ background: 'linear-gradient(180deg,#1565C0,#0D2B5E)' }} />
          <h2 className="font-display text-base" style={{ color: '#0D2B5E' }}>Clientes guardados</h2>
          <span className="ml-auto text-xs text-slate-400">{clients.length} clientes</span>
        </div>

        {clients.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-sm">No hay clientes guardados aún.</p>
            <p className="text-xs mt-1">Completa el formulario arriba para comenzar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map(c => {
              const cfg = RISK_PROFILES.find(r => r.label === c.params.profile)!
              const cur: Currency = c.params.currency
              const isExpanded = expandId === c.id

              return (
                <div key={c.id} className="rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-all">

                  {/* Main row */}
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#1565C0,#0D2B5E)' }}>
                      {initials(c.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: '#0D2B5E' }}>{c.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.email && <span>{c.email} · </span>}
                        <strong>{fmt(c.params.amount, cur)}</strong> · {c.params.termYears} años ·
                        Cuota: <strong>{fmt(c.result.monthlyPayment, cur)}/mes</strong>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {c.savedAt}
                        {c.occupation && <span> · {c.occupation}</span>}
                        {c.monthlyIncome && <span> · Ingresos: {c.monthlyIncome}</span>}
                        {c.documents && c.documents.length > 0 && (
                          <span className="ml-2 text-blue-500 font-semibold">
                            📎 {c.documents.length} doc{c.documents.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                      {(c.nationality || c.idNumber) && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {c.idType && c.idNumber && <span>{c.idType}: {c.idNumber}</span>}
                          {c.nationality && <span> · {c.nationality}</span>}
                        </p>
                      )}
                    </div>

                    <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background: cfg.colorBg, color: cfg.colorText }}>
                      {cfg.emoji} {cfg.label}
                    </span>

                    <div className="flex gap-2 flex-shrink-0">
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
                          📎
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
                    <div className="border-t border-slate-100 px-4 pb-5 pt-4 bg-slate-50 space-y-4">

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
