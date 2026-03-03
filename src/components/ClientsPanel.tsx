'use client'
import { useState, useEffect } from 'react'
import { LoanParams, LoanResult, RiskProfile, Currency, RISK_PROFILES, formatCurrency } from '@/lib/loan'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientDoc {
  id: string; name: string; url: string; type: string; size: number; uploadedAt: string
}
interface Client {
  id: string; name: string; email: string; phone: string; notes: string
  params: LoanParams; result: LoanResult; savedAt: string
  documents?: ClientDoc[]
}
interface Props {
  currentParams: LoanParams
  currentResult: LoanResult
  onLoadClient:  (params: LoanParams) => void
}

type StorageMode = 'loading' | 'local' | 'cloud'

const LOCAL_KEY = 'jvf_clients'

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}
function docIcon(type: string) {
  return type.includes('pdf') ? '📄' : type.includes('image') ? '🖼️' : type.includes('word') ? '📝' : '📁'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientsPanel({ currentParams, currentResult, onLoadClient }: Props) {
  const [clients,  setClients]  = useState<Client[]>([])
  const [mode,     setMode]     = useState<StorageMode>('loading')
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [phone,    setPhone]    = useState('')
  const [notes,    setNotes]    = useState('')
  const [saved,    setSaved]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [expandId, setExpandId] = useState<string | null>(null)
  const [uploading,setUploading]= useState<string | null>(null)

  // ── Detect storage mode & load clients on mount ────────────────────────────
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

      // Fallback: localStorage
      try {
        const raw = localStorage.getItem(LOCAL_KEY)
        if (raw) setClients(JSON.parse(raw))
      } catch { /* ignore */ }
      setMode('local')
    }
    init()
  }, [])

  // ── Keep localStorage in sync when in local mode ───────────────────────────
  useEffect(() => {
    if (mode === 'local') {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(clients)) } catch { /* ignore */ }
    }
  }, [clients, mode])

  // ── Save client ────────────────────────────────────────────────────────────
  const saveClient = async () => {
    if (!name.trim() || saving) return
    setSaving(true)

    if (mode === 'cloud') {
      try {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, notes,
                                 params: currentParams, result: currentResult }),
        })
        if (res.ok) {
          const data = await res.json()
          const client: Client = {
            id: data.id,
            name: name.trim(), email: email.trim(),
            phone: phone.trim(), notes: notes.trim(),
            params: currentParams, result: currentResult,
            savedAt: new Date(data.savedAt).toLocaleDateString('es-AR',
              { day: '2-digit', month: 'short', year: 'numeric' }),
            documents: [],
          }
          setClients(prev => [client, ...prev])
          setName(''); setEmail(''); setPhone(''); setNotes('')
          setSaved(true); setTimeout(() => setSaved(false), 2500)
        }
      } catch (err) {
        console.error('Error saving client', err)
      }
    } else {
      const client: Client = {
        id: String(Date.now()),
        name: name.trim(), email: email.trim(),
        phone: phone.trim(), notes: notes.trim(),
        params: currentParams, result: currentResult,
        savedAt: new Date().toLocaleDateString('es-AR',
          { day: '2-digit', month: 'short', year: 'numeric' }),
        documents: [],
      }
      setClients(prev => [client, ...prev])
      setName(''); setEmail(''); setPhone(''); setNotes('')
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

  const fmt = (v: number, cur: Currency) => formatCurrency(v, cur)

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Storage mode banner */}
      {mode !== 'loading' && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border"
          style={{
            background:   mode === 'cloud' ? '#E8F5E9' : '#FFF8E1',
            borderColor:  mode === 'cloud' ? '#2E7D3233' : '#F59E0B33',
            color:        mode === 'cloud' ? '#1B5E20'  : '#6D4C00',
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
            Guardar simulación actual como cliente
          </h2>
        </div>

        {/* Current simulation summary */}
        <div className="rounded-xl p-4 mb-5 border border-slate-200 bg-slate-50 text-xs flex flex-wrap gap-4">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {[
            { id: 'cn',  label: 'Nombre completo *', value: name,  set: setName,  placeholder: 'Ej: María García',         type: 'text' },
            { id: 'ce',  label: 'Email',             value: email, set: setEmail, placeholder: 'cliente@email.com',         type: 'email' },
            { id: 'cp',  label: 'Teléfono',          value: phone, set: setPhone, placeholder: '+54 11 1234-5678',          type: 'text' },
            { id: 'cn2', label: 'Notas',             value: notes, set: setNotes, placeholder: 'Observaciones adicionales', type: 'text' },
          ].map(f => (
            <div key={f.id}>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                {f.label}
              </label>
              <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                style={{ color: '#374151' }} />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={saveClient} disabled={!name.trim() || saving}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
            {saving ? '⏳ Guardando...' : '💾 Guardar cliente'}
          </button>
          {saved && <span className="text-sm font-semibold text-green-600">✅ Cliente guardado</span>}
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
                      {(c.notes || c.savedAt) && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {c.savedAt}{c.notes && ` · ${c.notes}`}
                          {c.documents && c.documents.length > 0 && (
                            <span className="ml-2 text-blue-500 font-semibold">
                              📎 {c.documents.length} doc{c.documents.length > 1 ? 's' : ''}
                            </span>
                          )}
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
                                   color: isExpanded ? '#fff' : '#1565C0' }}>
                          📎
                        </button>
                      )}
                      <button onClick={() => removeClient(c.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Documents panel (Neo4j only) */}
                  {isExpanded && mode === 'cloud' && (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50">
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
