'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LendStackLogo from '@/components/LendStackLogo'
import { Branch } from '@/lib/loan'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchDoc {
  id: string; name: string; type: Branch; createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<Branch, { label: string; emoji: string; bg: string; color: string; border: string }> = {
  sede:  { label: 'Sede',  emoji: '🏢', bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  rutas: { label: 'Rutas', emoji: '🛵', bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA' },
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminBranchesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [branches,  setBranches]  = useState<BranchDoc[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  // ── Create-branch form ───────────────────────────────────────────────────────
  const [name,      setName]      = useState('')
  const [type,      setType]      = useState<Branch>('sede')
  const [creating,  setCreating]  = useState(false)
  const [createErr, setCreateErr] = useState('')
  const [createOk,  setCreateOk]  = useState(false)

  // ── Delete state ─────────────────────────────────────────────────────────────
  const [deleteErr, setDeleteErr] = useState<Record<string, string>>({})

  // Redirect non-master users
  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'master') router.replace('/')
  }, [session, status, router])

  // Load branches
  useEffect(() => {
    if (session?.user.role !== 'master') return
    fetch('/api/admin/branches')
      .then(r => r.json())
      .then(d => { setBranches(d.branches ?? []); setLoading(false) })
      .catch(() => { setError('No se pudo cargar la lista de sucursales.'); setLoading(false) })
  }, [session])

  // ── Create branch ────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateErr('')
    if (!name.trim()) { setCreateErr('El nombre es obligatorio.'); return }

    setCreating(true)
    const res  = await fetch('/api/admin/branches', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: name.trim(), type }),
    })
    const data = await res.json()
    setCreating(false)

    if (res.ok) {
      setBranches(prev => [...prev, data.branch])
      setName('')
      setType('sede')
      setCreateOk(true); setTimeout(() => setCreateOk(false), 3000)
    } else {
      setCreateErr(data.error ?? 'Error al crear la sucursal.')
    }
  }

  // ── Delete branch ────────────────────────────────────────────────────────────
  const handleDelete = async (id: string, branchName: string) => {
    if (!confirm(`¿Eliminar la sucursal "${branchName}"? Esta acción no se puede deshacer.`)) return
    setDeleteErr(prev => ({ ...prev, [id]: '' }))

    const res  = await fetch(`/api/admin/branches/${id}`, { method: 'DELETE' })
    const data = await res.json()

    if (res.ok) {
      setBranches(prev => prev.filter(b => b.id !== id))
    } else {
      setDeleteErr(prev => ({ ...prev, [id]: data.error ?? 'Error al eliminar.' }))
    }
  }

  if (status === 'loading' || session?.user.role !== 'master') return null

  const sedeList  = branches.filter(b => b.type === 'sede')
  const rutasList = branches.filter(b => b.type === 'rutas')

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">

      {/* ── Header ── */}
      <header className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #071a3e 0%, #0D2B5E 55%, #1565C0 100%)', boxShadow: '0 4px 32px rgba(7,26,62,.4)' }}>
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
        <div className="relative max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <LendStackLogo variant="light" size={38} />
            <div className="pl-2 border-l border-white/20">
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9eb8da' }}>Administración</p>
              <h1 className="font-display text-xl text-white leading-tight">Gestión de Sucursales</h1>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/admin/users"
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,.10)', color: '#fff', border: '1px solid rgba(255,255,255,.20)' }}>
              👥 Usuarios
            </Link>
            <Link href="/app"
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.25)' }}>
              ← Volver a la app
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">

        {/* ── Branch list ── */}
        <div className="rounded-2xl bg-white border border-slate-200" style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-slate-100">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#1565C0,#0D2B5E)' }} />
            <h2 className="font-display text-base" style={{ color: '#0D2B5E' }}>Sucursales registradas</h2>
            <span className="ml-auto text-xs text-slate-400">
              {branches.length} sucursal{branches.length !== 1 ? 'es' : ''}
            </span>
          </div>

          {loading ? (
            <p className="text-center py-10 text-slate-400 text-sm">Cargando...</p>
          ) : error ? (
            <p className="text-center py-10 text-red-400 text-sm">{error}</p>
          ) : branches.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-3">🏢</p>
              <p className="text-sm">No hay sucursales creadas aún.</p>
              <p className="text-xs mt-1">Usá el formulario de abajo para agregar la primera.</p>
            </div>
          ) : (
            <div>
              {/* Grouped by type */}
              {([['sede', sedeList], ['rutas', rutasList]] as [Branch, BranchDoc[]][]).map(([t, list]) => {
                if (list.length === 0) return null
                const tcfg = TYPE_CFG[t]
                return (
                  <div key={t}>
                    {/* Type header */}
                    <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-100"
                      style={{ background: tcfg.bg }}>
                      <span className="text-sm">{tcfg.emoji}</span>
                      <span className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: tcfg.color }}>
                        {tcfg.label}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {list.map(b => (
                        <div key={b.id} className="flex items-center gap-4 px-6 py-4">
                          {/* Icon */}
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                            style={{ background: tcfg.bg, border: `1.5px solid ${tcfg.border}` }}>
                            {tcfg.emoji}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold" style={{ color: '#0D2B5E' }}>{b.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Creada: {fmtDate(b.createdAt)}</p>
                            {deleteErr[b.id] && (
                              <p className="text-xs text-red-500 mt-1">⚠️ {deleteErr[b.id]}</p>
                            )}
                          </div>

                          {/* Type badge */}
                          <span className="text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 hidden sm:block"
                            style={{ background: tcfg.bg, color: tcfg.color, border: `1px solid ${tcfg.border}` }}>
                            {tcfg.emoji} {tcfg.label}
                          </span>

                          {/* Delete */}
                          <button onClick={() => handleDelete(b.id, b.name)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors bg-red-50 text-red-600 hover:bg-red-100">
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Create branch form ── */}
        <div className="rounded-2xl bg-white border border-slate-200" style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-slate-100">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#1565C0,#0D2B5E)' }} />
            <h2 className="font-display text-base" style={{ color: '#0D2B5E' }}>Nueva sucursal</h2>
          </div>

          <form onSubmit={handleCreate} className="p-6">
            {/* Info banner */}
            <div className="px-4 py-3 rounded-xl mb-5 text-xs"
              style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF' }}>
              🏢 Las sucursales quedan disponibles al registrar nuevos clientes. Podés crear tantas rutas y sedes como necesites.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Nombre *
                </label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ej: Ruta Norte, Sede Central..."
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  style={{ color: '#374151' }} />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Tipo *
                </label>
                <div className="flex gap-2">
                  {(['sede', 'rutas'] as Branch[]).map(t => {
                    const tc = TYPE_CFG[t]
                    const active = type === t
                    return (
                      <button key={t} type="button" onClick={() => setType(t)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-1.5"
                        style={{
                          background:  active ? tc.bg      : '#f8fafc',
                          color:       active ? tc.color   : '#64748b',
                          borderColor: active ? tc.border  : '#e2e8f0',
                        }}>
                        {tc.emoji} {tc.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {createErr && (
              <div className="px-4 py-3 rounded-xl mb-4 bg-red-50 border border-red-200 text-sm text-red-600">
                ⚠️ {createErr}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={creating || !name.trim()}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
                {creating ? '⏳ Creando...' : '➕ Crear sucursal'}
              </button>
              {createOk && <span className="text-sm font-semibold text-green-600">✅ Sucursal creada</span>}
            </div>
          </form>
        </div>

      </main>
    </div>
  )
}
