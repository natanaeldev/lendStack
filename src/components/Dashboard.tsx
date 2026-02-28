'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { formatCurrency, RISK_PROFILES, Currency } from '@/lib/loan'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatsData {
  configured: boolean
  totalClients: number; totalLoans: number; totalAmount: number
  avgMonthlyPayment: number; avgAmount: number; totalInterest: number
  byProfile:   { profile: string; count: number; totalAmount: number }[]
  byCurrency:  { currency: string; count: number; totalAmount: number }[]
  recentClients: RecentClient[]
}
interface RecentClient {
  id: string; name: string; email: string; savedAt: string
  amount: number; profile: string; currency: Currency; monthlyPayment: number
}
interface ClientDoc {
  id: string; name: string; url: string; type: string; size: number; uploadedAt: string
}
interface ClientRow {
  id: string; name: string; email: string; phone: string; notes: string; savedAt: string
  params: any; result: any; documents: ClientDoc[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROFILE_COLOR: Record<string, string> = {
  'Low Risk': '#2E7D32', 'Medium Risk': '#F59E0B', 'High Risk': '#EF4444',
}
const CURRENCY_COLORS = ['#1565C0', '#0D2B5E', '#2E7D32', '#F59E0B']

const SECTION_BAR = (
  <div className="w-1 h-6 rounded-full flex-shrink-0"
    style={{ background: 'linear-gradient(180deg,#1565C0,#0D2B5E)' }} />
)

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  emoji, label, value, sub, color,
}: { emoji: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl p-5 bg-white border border-slate-200"
      style={{ boxShadow: '0 2px 14px rgba(0,0,0,.06)' }}>
      <p className="text-2xl mb-3">{emoji}</p>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className="font-display text-2xl font-bold leading-none" style={{ color: color ?? '#0D2B5E' }}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
    </div>
  )
}

function SetupScreen() {
  return (
    <div className="rounded-2xl p-10 bg-white border border-slate-200 text-center"
      style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
      <p className="text-5xl mb-4">🗄️</p>
      <h2 className="font-display text-2xl mb-2" style={{ color: '#0D2B5E' }}>Conectar Neo4j</h2>
      <p className="text-slate-500 mb-6 text-sm max-w-md mx-auto">
        El dashboard usa <strong>Neo4j Aura</strong> como base de datos en la nube.
        Creá una instancia gratuita y configurá las variables de entorno.
      </p>

      <div className="rounded-xl p-5 bg-slate-50 border border-slate-200 text-left max-w-lg mx-auto mb-6 font-mono text-xs space-y-1.5">
        <p className="font-sans text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Variables requeridas — .env.local
        </p>
        {[
          ['NEO4J_URI',              'neo4j+s://xxxx.databases.neo4j.io'],
          ['NEO4J_USER',             'neo4j'],
          ['NEO4J_PASSWORD',         'tu_contraseña'],
          ['BLOB_READ_WRITE_TOKEN',  'vercel_blob_xxxx  ← para subir documentos'],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-blue-600 font-bold">{k}</span>
            <span className="text-slate-400">=</span>
            <span className="text-slate-500">{v}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-3 flex-wrap">
        <a href="https://neo4j.com/cloud/platform/aura-graph-database/"
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
          🚀 Crear cuenta Neo4j Aura (gratis)
        </a>
        <a href="https://vercel.com/docs/storage/vercel-blob"
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border-2"
          style={{ color: '#1565C0', borderColor: '#1565C0' }}>
          📦 Vercel Blob (documentos)
        </a>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [stats,    setStats]    = useState<StatsData | null>(null)
  const [clients,  setClients]  = useState<ClientRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [notConf,  setNotConf]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [uploading,setUploading]= useState<string | null>(null)
  const [expandDoc,setExpandDoc]= useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ])
      .then(([s, c]) => {
        if (s.configured === false) { setNotConf(true); return }
        setStats(s)
        setClients(c.clients ?? [])
      })
      .catch(() => setNotConf(true))
      .finally(() => setLoading(false))
  }, [])

  // ── Filtered clients ────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    clients.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    ), [clients, search])

  // ── Document upload ─────────────────────────────────────────────────────────
  const handleUpload = async (clientId: string, file: File) => {
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

  // ── Delete client ───────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente permanentemente?')) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    setClients(prev => prev.filter(c => c.id !== id))
    if (stats) setStats(s => s ? { ...s, totalClients: s.totalClients - 1, totalLoans: s.totalLoans - 1 } : s)
  }

  const fmt = (v: number, cur: Currency = 'USD') => formatCurrency(v, cur)

  // ── Render helpers ──────────────────────────────────────────────────────────
  const docIcon = (type: string) =>
    type.includes('pdf') ? '📄' : type.includes('image') ? '🖼️' : type.includes('word') ? '📝' : '📁'

  // ── Early returns ───────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center text-slate-400">
        <p className="text-5xl mb-3 animate-pulse">⏳</p>
        <p className="text-sm">Cargando dashboard...</p>
      </div>
    </div>
  )

  if (notConf) return <SetupScreen />

  // ── Full dashboard ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Stats cards ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard emoji="👥" label="Total Clientes"
            value={stats.totalClients} color="#1565C0"
            sub={`${stats.totalLoans} préstamos registrados`} />
          <StatCard emoji="💰" label="Capital Total"
            value={`$${(stats.totalAmount / 1_000).toFixed(0)}K`} color="#2E7D32"
            sub="suma de todos los préstamos" />
          <StatCard emoji="💵" label="Cuota Promedio"
            value={`$${Math.round(stats.avgMonthlyPayment).toLocaleString()}`} color="#0D2B5E"
            sub="por mes" />
          <StatCard emoji="📈" label="Interés Total"
            value={`$${(stats.totalInterest / 1_000).toFixed(0)}K`} color="#F59E0B"
            sub="generado en todos los préstamos" />
        </div>
      )}

      {/* ── Charts ── */}
      {stats && stats.byProfile.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Bar chart — by risk profile */}
          <div className="rounded-2xl p-6 bg-white border border-slate-200"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
            <div className="flex items-center gap-2.5 mb-5">
              {SECTION_BAR}
              <h3 className="font-display text-base" style={{ color: '#0D2B5E' }}>
                Préstamos por perfil de riesgo
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.byProfile} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4fa" vertical={false} />
                <XAxis dataKey="profile" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v: any) => [v, 'Cantidad']}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {stats.byProfile.map((e, i) => (
                    <Cell key={i} fill={PROFILE_COLOR[e.profile] ?? '#1565C0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex gap-3 flex-wrap mt-3">
              {stats.byProfile.map(p => (
                <div key={p.profile} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-2.5 h-2.5 rounded-full"
                    style={{ background: PROFILE_COLOR[p.profile] ?? '#1565C0' }} />
                  {p.profile}: <strong style={{ color: '#0D2B5E' }}>{p.count}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Pie chart — by currency */}
          <div className="rounded-2xl p-6 bg-white border border-slate-200"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
            <div className="flex items-center gap-2.5 mb-5">
              {SECTION_BAR}
              <h3 className="font-display text-base" style={{ color: '#0D2B5E' }}>
                Distribución por moneda
              </h3>
            </div>
            {stats.byCurrency.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={stats.byCurrency} dataKey="count" nameKey="currency"
                    cx="50%" cy="50%" outerRadius={80}
                    label={({ currency, percent }) =>
                      `${currency} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {stats.byCurrency.map((_, i) => (
                      <Cell key={i} fill={CURRENCY_COLORS[i % CURRENCY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                Sin datos todavía
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Client Table ── */}
      <div className="rounded-2xl bg-white border border-slate-200"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>

        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            {SECTION_BAR}
            <h3 className="font-display text-base" style={{ color: '#0D2B5E' }}>
              Todos los clientes
            </h3>
            <span className="text-xs text-slate-400 ml-1">({filtered.length})</span>
          </div>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar por nombre o email..."
            className="px-4 py-2 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors w-full sm:w-72"
            style={{ color: '#374151' }} />
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-14 text-slate-400">
            <p className="text-4xl mb-3">{search ? '🔍' : '👥'}</p>
            <p className="text-sm">
              {search ? 'Sin resultados para esa búsqueda' : 'No hay clientes en la base de datos'}
            </p>
            {!search && (
              <p className="text-xs mt-1">
                Guardá clientes desde la pestaña <strong>👥 Clientes</strong>
              </p>
            )}
          </div>
        )}

        {/* Client rows */}
        <div className="divide-y divide-slate-100">
          {filtered.map(c => {
            const profile = RISK_PROFILES.find(p => p.label === c.params?.profile)
            const cur: Currency = c.params?.currency ?? 'USD'
            const isExpanded = expandDoc === c.id

            return (
              <div key={c.id} className="px-6 py-4">

                {/* Row */}
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#1565C0,#0D2B5E)' }}>
                    {c.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-bold" style={{ color: '#0D2B5E' }}>{c.name}</p>
                      {profile && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: profile.colorBg, color: profile.colorText }}>
                          {profile.emoji} {profile.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {c.email && <span className="mr-2">{c.email}</span>}
                      <strong>{fmt(c.params?.amount ?? 0, cur)}</strong>
                      {' · '}
                      {c.params?.termYears} años
                      {c.result && (
                        <> · Cuota: <strong>{fmt(c.result.monthlyPayment, cur)}/mes</strong></>
                      )}
                    </p>
                    {c.savedAt && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(c.savedAt).toLocaleDateString('es-AR',
                          { day: '2-digit', month: 'short', year: 'numeric' })}
                        {c.documents?.length > 0 && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold"
                            style={{ background: '#e8eef7', color: '#1565C0' }}>
                            📎 {c.documents.length} doc{c.documents.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Upload button */}
                    <button
                      onClick={() => setExpandDoc(isExpanded ? null : c.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: isExpanded ? '#0D2B5E' : '#e8eef7',
                               color: isExpanded ? '#fff' : '#1565C0' }}>
                      📎 Docs {c.documents?.length > 0 && `(${c.documents.length})`}
                    </button>
                    <button onClick={() => handleDelete(c.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Documents panel (collapsible) */}
                {isExpanded && (
                  <div className="mt-3 ml-14 rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Documentos del cliente
                    </p>

                    {/* Existing docs */}
                    {c.documents?.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {c.documents.map(doc => (
                          <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all"
                            style={{ color: '#0D2B5E' }}>
                            {docIcon(doc.type)} {doc.name}
                            <span className="text-slate-400 font-normal">
                              ({(doc.size / 1024).toFixed(0)} KB)
                            </span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mb-3">Sin documentos adjuntos.</p>
                    )}

                    {/* Upload new doc */}
                    <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border-2 border-dashed ${uploading === c.id ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 hover:text-blue-600'}`}
                      style={{ borderColor: '#c5d5ea', color: '#64748b' }}>
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploading === c.id}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xlsx,.xls"
                        ref={el => { fileInputRefs.current[c.id] = el }}
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) handleUpload(c.id, f)
                          e.target.value = ''
                        }}
                      />
                      {uploading === c.id ? '⏳ Subiendo...' : '+ Subir documento'}
                    </label>
                    <p className="text-xs text-slate-400 mt-2">
                      PDF, Word, Excel, imágenes · Máx. 10 MB
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
