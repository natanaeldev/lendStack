'use client'
import { useState, useEffect } from 'react'
import { Client, LoanParams, LoanResult, RiskProfile, Currency, RISK_PROFILES, formatCurrency } from '@/lib/loan'

interface Props {
  currentParams: LoanParams
  currentResult: LoanResult
  onLoadClient:  (params: LoanParams) => void
}

const STORAGE_KEY = 'jvf_clients'

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export default function ClientsPanel({ currentParams, currentResult, onLoadClient }: Props) {
  const [clients, setClients]   = useState<Client[]>([])
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [notes, setNotes]       = useState('')
  const [saved, setSaved]       = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setClients(JSON.parse(stored))
    } catch {}
  }, [])

  // Persist to localStorage whenever clients changes
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clients)) } catch {}
  }, [clients])

  const saveClient = () => {
    if (!name.trim()) return
    const client: Client = {
      id:      String(Date.now()),
      name:    name.trim(),
      email:   email.trim(),
      phone:   phone.trim(),
      notes:   notes.trim(),
      params:  currentParams,
      result:  currentResult,
      savedAt: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }),
    }
    setClients(prev => [client, ...prev])
    setName(''); setEmail(''); setPhone(''); setNotes('')
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const removeClient = (id: string) => setClients(prev => prev.filter(c => c.id !== id))

  const fmt = (v: number, cur: Currency) => formatCurrency(v, cur)

  return (
    <div className="space-y-5">
      {/* New client form */}
      <div className="rounded-2xl p-6 bg-white border border-slate-200" style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #1565C0, #0D2B5E)' }} />
          <h2 className="font-display text-base" style={{ color: '#0D2B5E' }}>Guardar simulación actual como cliente</h2>
        </div>

        {/* Current simulation summary */}
        <div className="rounded-xl p-4 mb-5 border border-slate-200 bg-slate-50 text-xs flex flex-wrap gap-4">
          {[
            ['Monto',    fmt(currentParams.amount, currentParams.currency)],
            ['Plazo',    `${currentParams.termYears} años`],
            ['Perfil',   `${RISK_PROFILES.find(r=>r.label===currentParams.profile)?.emoji} ${currentParams.profile}`],
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
            { id: 'cn', label: 'Nombre completo *', value: name,  set: setName,  placeholder: 'Ej: María García',         type: 'text' },
            { id: 'ce', label: 'Email',              value: email, set: setEmail, placeholder: 'cliente@email.com',         type: 'email' },
            { id: 'cp', label: 'Teléfono',           value: phone, set: setPhone, placeholder: '+54 11 1234-5678',          type: 'text' },
            { id: 'cn2',label: 'Notas',              value: notes, set: setNotes, placeholder: 'Observaciones adicionales', type: 'text' },
          ].map(f => (
            <div key={f.id}>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{f.label}</label>
              <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                style={{ color: '#374151' }} />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={saveClient} disabled={!name.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}>
            💾 Guardar cliente
          </button>
          {saved && <span className="text-sm font-semibold text-green-600">✅ Cliente guardado</span>}
        </div>
      </div>

      {/* Client list */}
      <div className="rounded-2xl p-6 bg-white border border-slate-200" style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #1565C0, #0D2B5E)' }} />
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
              return (
                <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #1565C0, #0D2B5E)' }}>
                    {initials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: '#0D2B5E' }}>{c.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {c.email && <span>{c.email} · </span>}
                      <strong>{fmt(c.params.amount, c.params.currency)}</strong> · {c.params.termYears} años ·
                      Cuota: <strong>{fmt(c.result.monthlyPayment, c.params.currency)}/mes</strong>
                    </p>
                    {(c.notes || c.savedAt) && (
                      <p className="text-xs text-slate-400 mt-0.5">{c.savedAt}{c.notes && ` · ${c.notes}`}</p>
                    )}
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{ background: cfg.colorBg, color: cfg.colorText }}>{cfg.emoji} {cfg.label}</span>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => onLoadClient(c.params)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: '#e8eef7', color: '#0D2B5E' }}>📂 Cargar</button>
                    <button onClick={() => removeClient(c.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-red-50 text-red-600 hover:bg-red-100">🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
