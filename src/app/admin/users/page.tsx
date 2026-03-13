'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LendStackLogo from '@/components/LendStackLogo'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchDoc { id: string; name: string; type: 'sede' | 'rutas' }
interface AppUser {
  id: string; name: string; email: string; role: string; createdAt: string
  allowedBranchIds: string[] | null  // null = all branches
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_CFG: Record<string, { label: string; bg: string; color: string; avatar: string }> = {
  master:   { label: '👑 Maestro',    bg: '#FFF8E1', color: '#6D4C00', avatar: 'linear-gradient(135deg,#6D4C00,#F9A825)'  },
  manager:  { label: '👔 Gerente',    bg: '#EEF2FF', color: '#3730A3', avatar: 'linear-gradient(135deg,#3730A3,#6366F1)'  },
  operator: { label: '🛠️ Operador',  bg: '#ECFDF5', color: '#065F46', avatar: 'linear-gradient(135deg,#065F46,#10B981)'  },
  user:     { label: '👤 Usuario',    bg: '#E8F0FE', color: '#1a3a8f', avatar: 'linear-gradient(135deg,#1565C0,#0D2B5E)'  },
}
const BRANCH_CFG: Record<string, { emoji: string; color: string }> = {
  sede:  { emoji: '🏢', color: '#1E40AF' },
  rutas: { emoji: '🛵', color: '#9A3412' },
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [users,     setUsers]     = useState<AppUser[]>([])
  const [branches,  setBranches]  = useState<BranchDoc[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [resetId,   setResetId]   = useState<string | null>(null)

  // ── Create-user form ────────────────────────────────────────────────────────
  const [form,      setForm]      = useState({ name: '', email: '', password: '', confirm: '', role: 'user' })
  const [formBranches, setFormBranches] = useState<string[] | null>(null)  // null = all
  const [creating,  setCreating]  = useState(false)
  const [createErr, setCreateErr] = useState('')
  const [createOk,  setCreateOk]  = useState(false)

  // ── Reset-password form ─────────────────────────────────────────────────────
  const [newPwd,       setNewPwd]       = useState('')
  const [resetErr,     setResetErr]     = useState('')
  const [resetting,    setResetting]    = useState(false)
  const [resetOk,      setResetOk]      = useState(false)

  // ── Role-change ──────────────────────────────────────────────────────────────
  const [roleId,       setRoleId]       = useState<string | null>(null)
  const [roleChanging, setRoleChanging] = useState(false)
  const [roleOk,       setRoleOk]       = useState(false)

  // ── Branch-access panel ─────────────────────────────────────────────────────
  const [branchUserId,   setBranchUserId]  = useState<string | null>(null)
  const [branchSaving,   setBranchSaving]  = useState(false)
  const [branchOk,       setBranchOk]      = useState(false)
  // Draft allowedBranchIds while editing — null = all, string[] = restricted
  const [branchDraft,    setBranchDraft]   = useState<string[] | null>(null)

  // Redirect non-master users
  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'master') router.replace('/')
  }, [session, status, router])

  // Load users + branches
  useEffect(() => {
    if (session?.user.role !== 'master') return
    Promise.all([
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/admin/branches').then(r => r.json()).catch(() => ({ branches: [] })),
    ]).then(([ud, bd]) => {
      setUsers(ud.users ?? [])
      setBranches(bd.branches ?? [])
      setLoading(false)
    }).catch(() => { setError('No se pudo cargar la lista de usuarios.'); setLoading(false) })
  }, [session])

  // ── Create sub-user ─────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateErr('')
    if (form.password.length < 8)    { setCreateErr('La contraseña debe tener al menos 8 caracteres.'); return }
    if (form.password !== form.confirm) { setCreateErr('Las contraseñas no coinciden.'); return }

    setCreating(true)
    const res  = await fetch('/api/admin/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:             form.name,
        email:            form.email,
        password:         form.password,
        role:             form.role,
        allowedBranchIds: formBranches,
      }),
    })
    const data = await res.json()
    setCreating(false)

    if (res.ok) {
      setUsers(prev => [...prev, data.user])
      setForm({ name: '', email: '', password: '', confirm: '', role: 'user' })
      setFormBranches(null)
      setCreateOk(true); setTimeout(() => setCreateOk(false), 3000)
    } else {
      setCreateErr(data.error ?? 'Error al crear usuario.')
    }
  }

  // ── Delete sub-user ─────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (res.ok) setUsers(prev => prev.filter(u => u.id !== id))
  }

  // ── Reset password ──────────────────────────────────────────────────────────
  const handleReset = async (id: string) => {
    setResetErr('')
    if (newPwd.length < 8) { setResetErr('Mín. 8 caracteres.'); return }
    setResetting(true)
    const res  = await fetch(`/api/admin/users/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: newPwd }),
    })
    setResetting(false)
    if (res.ok) {
      setResetOk(true); setTimeout(() => { setResetOk(false); setResetId(null); setNewPwd('') }, 2000)
    } else {
      const d = await res.json(); setResetErr(d.error ?? 'Error.')
    }
  }

  // ── Change role ─────────────────────────────────────────────────────────────
  const handleRoleChange = async (id: string, newRole: string) => {
    setRoleChanging(true)
    const res = await fetch(`/api/admin/users/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role: newRole }),
    })
    setRoleChanging(false)
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u))
      setRoleOk(true); setTimeout(() => { setRoleOk(false); setRoleId(null) }, 2000)
    }
  }

  // ── Save branch access ──────────────────────────────────────────────────────
  const handleBranchSave = async (id: string) => {
    setBranchSaving(true)
    const res = await fetch(`/api/admin/users/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ allowedBranchIds: branchDraft }),
    })
    setBranchSaving(false)
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, allowedBranchIds: branchDraft } : u))
      setBranchOk(true); setTimeout(() => { setBranchOk(false); setBranchUserId(null) }, 2000)
    }
  }

  const openBranchPanel = (u: AppUser) => {
    setBranchUserId(u.id)
    setBranchDraft(u.allowedBranchIds)
    setBranchOk(false)
    setResetId(null)
    setRoleId(null)
  }

  const toggleBranchDraft = (branchId: string) => {
    setBranchDraft(prev => {
      if (prev === null) return [branchId]          // switch from "all" to restricted
      if (prev.includes(branchId)) {
        const next = prev.filter(b => b !== branchId)
        return next.length === 0 ? null : next      // empty → back to "all" not useful; keep null
      }
      return [...prev, branchId]
    })
  }

  const toggleFormBranch = (branchId: string) => {
    setFormBranches(prev => {
      if (prev === null) return [branchId]
      if (prev.includes(branchId)) {
        const next = prev.filter(b => b !== branchId)
        return next
      }
      return [...prev, branchId]
    })
  }

  if (status === 'loading' || (session?.user.role !== 'master')) return null

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">

      {/* ── Header ── */}
      <header className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #071a3e 0%, #0D2B5E 55%, #1565C0 100%)', boxShadow: '0 4px 32px rgba(7,26,62,.4)' }}>
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
        <div className="relative max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <LendStackLogo variant="light" size={38} />
            <div className="pl-2 border-l border-white/20">
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9eb8da' }}>Administración</p>
              <h1 className="font-display text-xl text-white leading-tight">Gestión de Usuarios</h1>
            </div>
          </div>
          <Link href="/admin/branches"
            className="hidden md:flex items-center gap-2 text-xs px-4 py-2 rounded-xl font-semibold transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,.10)', color: '#fff', border: '1px solid rgba(255,255,255,.20)' }}>
            🏢 Sucursales
          </Link>
          <Link href="/app"
            className="hidden md:flex items-center gap-2 text-xs px-4 py-2 rounded-xl font-semibold transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.25)' }}>
            ← Volver a la app
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">

        {/* ── User list ── */}
        <div className="rounded-2xl bg-white border border-slate-200" style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-slate-100">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#1565C0,#0D2B5E)' }} />
            <h2 className="font-display text-base" style={{ color: '#0D2B5E' }}>Usuarios registrados</h2>
            <span className="ml-auto text-xs text-slate-400">{users.length} usuario{users.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <p className="text-center py-10 text-slate-400 text-sm">Cargando...</p>
          ) : error ? (
            <p className="text-center py-10 text-red-400 text-sm">{error}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {users.map(u => {
                const badge         = ROLE_CFG[u.role] ?? ROLE_CFG.user
                const isMe          = u.email === session?.user.email
                const isOpen        = resetId     === u.id
                const isRoleOpen    = roleId      === u.id
                const isBranchOpen  = branchUserId === u.id

                // Summarise branch access for display
                const branchLabel = u.allowedBranchIds === null
                  ? 'Todas las sucursales'
                  : u.allowedBranchIds.length === 0
                    ? 'Sin acceso'
                    : u.allowedBranchIds.map(bid => {
                        const b = branches.find(x => x.id === bid)
                        return b ? `${BRANCH_CFG[b.type]?.emoji ?? '🏢'} ${b.name}` : bid
                      }).join(', ')

                return (
                  <div key={u.id}>
                    {/* Main row */}
                    <div className="flex items-center gap-4 px-6 py-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ background: badge.avatar }}>
                        {(u.name || u.email).slice(0, 2).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="break-words text-sm font-bold" style={{ color: '#0D2B5E' }}>
                          {u.name || '—'}
                          {isMe && <span className="ml-2 text-xs font-normal text-slate-400">(vos)</span>}
                        </p>
                        <p className="break-all text-xs text-slate-500">{u.email}</p>
                        {u.role !== 'master' && branches.length > 0 && (
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">🏢 {branchLabel}</p>
                        )}
                      </div>

                      {/* Role badge */}
                      <span className="text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 hidden sm:block"
                        style={{ background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>

                      {/* Actions (sub-users only) */}
                      {u.role !== 'master' && (
                        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                          <button onClick={() => { setRoleId(isRoleOpen ? null : u.id); setRoleOk(false); setResetId(null); setBranchUserId(null) }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                            style={{ background: isRoleOpen ? '#3730A3' : '#EEF2FF', color: isRoleOpen ? '#fff' : '#3730A3' }}>
                            👔 Rol
                          </button>
                          {branches.length > 0 && (
                            <button onClick={() => { isBranchOpen ? setBranchUserId(null) : openBranchPanel(u); setResetId(null); setRoleId(null) }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                              style={{ background: isBranchOpen ? '#065F46' : '#ECFDF5', color: isBranchOpen ? '#fff' : '#065F46' }}>
                              🏢 Sucursales
                            </button>
                          )}
                          <button onClick={() => { setResetId(isOpen ? null : u.id); setNewPwd(''); setResetErr(''); setResetOk(false); setRoleId(null); setBranchUserId(null) }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                            style={{ background: isOpen ? '#0D2B5E' : '#e8eef7', color: isOpen ? '#fff' : '#1565C0' }}>
                            🔑 Contraseña
                          </button>
                          <button onClick={() => handleDelete(u.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Reset-password panel */}
                    {isOpen && (
                      <div className="px-6 pb-4 pt-0 bg-slate-50 border-t border-slate-100">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 pt-3">
                          Restablecer contraseña — {u.name || u.email}
                        </p>
                        <div className="flex items-end gap-3 flex-wrap">
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nueva contraseña (mín. 8 chars)</label>
                            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                              placeholder="••••••••"
                              className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                              style={{ color: '#374151' }} />
                          </div>
                          <button onClick={() => handleReset(u.id)} disabled={resetting || newPwd.length < 8}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
                            {resetting ? '⏳...' : '✅ Guardar'}
                          </button>
                        </div>
                        {resetErr && <p className="text-xs text-red-500 mt-2">{resetErr}</p>}
                        {resetOk  && <p className="text-xs text-green-600 mt-2 font-semibold">✅ Contraseña actualizada</p>}
                      </div>
                    )}

                    {/* Role-change panel */}
                    {isRoleOpen && (
                      <div className="px-6 pb-5 pt-0 bg-slate-50 border-t border-slate-100">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 pt-3">
                          Cambiar rol — {u.name || u.email}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { value: 'user',     label: '👤 Usuario',   desc: 'Acceso estándar' },
                            { value: 'operator', label: '🛠️ Operador',  desc: 'Gestión de clientes' },
                            { value: 'manager',  label: '👔 Gerente',   desc: 'Acceso completo' },
                          ].map(r => {
                            const rc  = ROLE_CFG[r.value]
                            const sel = u.role === r.value
                            return (
                              <button key={r.value}
                                onClick={() => handleRoleChange(u.id, r.value)}
                                disabled={roleChanging || sel}
                                className="flex-1 min-w-[90px] py-2.5 px-3 rounded-xl border-2 text-xs font-bold transition-all text-left disabled:cursor-default"
                                style={{
                                  background:  sel ? rc.bg    : '#f8fafc',
                                  color:       sel ? rc.color : '#64748b',
                                  borderColor: sel ? rc.color + '66' : '#e2e8f0',
                                  opacity:     roleChanging && !sel ? 0.5 : 1,
                                }}>
                                <span className="block">{r.label} {sel ? '✓' : ''}</span>
                                <span className="block font-normal text-[10px] mt-0.5 opacity-70">{r.desc}</span>
                              </button>
                            )
                          })}
                        </div>
                        {roleOk && <p className="text-xs text-green-600 mt-3 font-semibold">✅ Rol actualizado</p>}
                      </div>
                    )}

                    {/* Branch-access panel */}
                    {isBranchOpen && branches.length > 0 && (
                      <div className="px-6 pb-5 pt-0 bg-emerald-50 border-t border-emerald-100">
                        <div className="pt-3 mb-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Acceso a sucursales — {u.name || u.email}
                          </p>
                          <p className="text-xs text-slate-500">
                            Definí a qué sucursales puede ver este usuario. "Todas" no aplica ninguna restricción.
                          </p>
                        </div>

                        {/* All-branches toggle */}
                        <button
                          type="button"
                          onClick={() => setBranchDraft(null)}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-bold mb-3 transition-all text-left"
                          style={{
                            background:  branchDraft === null ? '#ECFDF5' : '#f8fafc',
                            color:       branchDraft === null ? '#065F46' : '#64748b',
                            borderColor: branchDraft === null ? '#10B981' : '#e2e8f0',
                          }}>
                          <span className="text-lg">🌐</span>
                          <span className="flex-1">Todas las sucursales</span>
                          {branchDraft === null && <span className="text-green-600">✓</span>}
                        </button>

                        {/* Individual branches */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                          {branches.map(b => {
                            const checked = branchDraft !== null && branchDraft.includes(b.id)
                            const cfg     = BRANCH_CFG[b.type] ?? BRANCH_CFG.sede
                            return (
                              <button key={b.id}
                                type="button"
                                onClick={() => toggleBranchDraft(b.id)}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all text-left"
                                style={{
                                  background:  checked ? '#E0F2FE' : '#f8fafc',
                                  color:       checked ? cfg.color  : '#64748b',
                                  borderColor: checked ? cfg.color  : '#e2e8f0',
                                }}>
                                <span className="text-lg">{cfg.emoji}</span>
                                <span className="flex-1">{b.name}</span>
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: b.type === 'sede' ? '#BFDBFE' : '#FED7AA', color: cfg.color }}>
                                  {b.type}
                                </span>
                                {checked && <span style={{ color: cfg.color }}>✓</span>}
                              </button>
                            )
                          })}
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleBranchSave(u.id)}
                            disabled={branchSaving}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg,#065F46,#10B981)' }}>
                            {branchSaving ? '⏳...' : '✅ Guardar acceso'}
                          </button>
                          <span className="text-xs text-slate-400">
                            {branchDraft === null
                              ? 'Acceso total a todas las sucursales'
                              : branchDraft.length === 0
                                ? 'Sin sucursales seleccionadas'
                                : `${branchDraft.length} sucursal${branchDraft.length !== 1 ? 'es' : ''} seleccionada${branchDraft.length !== 1 ? 's' : ''}`}
                          </span>
                          {branchOk && <span className="text-xs text-green-600 font-semibold ml-auto">✅ Guardado</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Create sub-user form ── */}
        <div className="rounded-2xl bg-white border border-slate-200" style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-slate-100">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#1565C0,#0D2B5E)' }} />
            <h2 className="font-display text-base" style={{ color: '#0D2B5E' }}>Agregar sub-usuario</h2>
          </div>

          <form onSubmit={handleCreate} className="p-6">
            <div className="px-4 py-3 rounded-xl mb-5 text-xs"
              style={{ background: '#E8F0FE', border: '1px solid #1565C033', color: '#1a3a8f' }}>
              Los sub-usuarios pueden iniciar sesión y usar la aplicación, pero <strong>no pueden crear ni eliminar otros usuarios</strong>. Asigná el rol y las sucursales que puede ver.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Nombre completo</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Laura Díaz"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  style={{ color: '#374151' }} />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="usuario@empresa.com" required
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  style={{ color: '#374151' }} />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Contraseña * <span className="font-normal normal-case text-slate-400">(mín. 8 chars)</span>
                </label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••" required
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  style={{ color: '#374151' }} />
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Confirmar contraseña *</label>
                <input type="password" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="••••••••" required
                  className={`w-full px-4 py-2.5 rounded-xl border-2 text-sm focus:outline-none transition-colors ${form.confirm && form.confirm !== form.password ? 'border-red-400' : 'border-slate-200 focus:border-blue-500'}`}
                  style={{ color: '#374151' }} />
                {form.confirm && form.confirm !== form.password && (
                  <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                )}
              </div>

              {/* Rol */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Rol del usuario</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'user',     label: '👤 Usuario',   desc: 'Acceso estándar a la aplicación'        },
                    { value: 'operator', label: '🛠️ Operador',  desc: 'Gestión de clientes y préstamos'        },
                    { value: 'manager',  label: '👔 Gerente',   desc: 'Acceso completo sin administración'     },
                  ].map(r => {
                    const rc  = ROLE_CFG[r.value]
                    const sel = form.role === r.value
                    return (
                      <button key={r.value} type="button"
                        onClick={() => setForm(p => ({ ...p, role: r.value }))}
                        className="flex-1 min-w-[100px] py-2.5 px-3 rounded-xl border-2 text-xs font-bold transition-all text-left"
                        style={{
                          background:  sel ? rc.bg    : '#f8fafc',
                          color:       sel ? rc.color : '#64748b',
                          borderColor: sel ? rc.color + '66' : '#e2e8f0',
                        }}>
                        <span className="block">{r.label}</span>
                        <span className="block font-normal text-[10px] mt-0.5 opacity-70">{r.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Sucursales (only if branches exist) */}
              {branches.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Acceso a sucursales
                  </label>
                  <p className="text-xs text-slate-400 mb-3">
                    Dejá en "Todas" para que vea toda la cartera, o seleccioná sucursales específicas.
                  </p>
                  {/* All toggle */}
                  <button type="button"
                    onClick={() => setFormBranches(null)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 text-sm font-bold mb-2 transition-all text-left"
                    style={{
                      background:  formBranches === null ? '#ECFDF5' : '#f8fafc',
                      color:       formBranches === null ? '#065F46' : '#64748b',
                      borderColor: formBranches === null ? '#10B981' : '#e2e8f0',
                    }}>
                    <span>🌐</span>
                    <span className="flex-1">Todas las sucursales</span>
                    {formBranches === null && <span className="text-green-600">✓</span>}
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {branches.map(b => {
                      const checked = formBranches !== null && formBranches.includes(b.id)
                      const cfg     = BRANCH_CFG[b.type] ?? BRANCH_CFG.sede
                      return (
                        <button key={b.id} type="button"
                          onClick={() => toggleFormBranch(b.id)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all text-left"
                          style={{
                            background:  checked ? '#E0F2FE' : '#f8fafc',
                            color:       checked ? cfg.color  : '#64748b',
                            borderColor: checked ? cfg.color  : '#e2e8f0',
                          }}>
                          <span>{cfg.emoji}</span>
                          <span className="flex-1">{b.name}</span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded"
                            style={{ background: b.type === 'sede' ? '#BFDBFE' : '#FED7AA', color: cfg.color }}>
                            {b.type}
                          </span>
                          {checked && <span style={{ color: cfg.color }}>✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {createErr && (
              <div className="px-4 py-3 rounded-xl mb-4 bg-red-50 border border-red-200 text-sm text-red-600">
                ⚠️ {createErr}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button type="submit"
                disabled={creating || !form.email || !form.password || form.password !== form.confirm}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
                {creating ? '⏳ Creando...' : '➕ Crear sub-usuario'}
              </button>
              {createOk && <span className="text-sm font-semibold text-green-600">✅ Usuario creado exitosamente</span>}
            </div>
          </form>
        </div>

      </main>
    </div>
  )
}
