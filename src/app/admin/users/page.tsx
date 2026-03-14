'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import ResponsiveActionBar from '@/components/admin-branches/ResponsiveActionBar'
import ResponsiveFormSection from '@/components/admin-branches/ResponsiveFormSection'
import AdminModuleHeader from '@/components/admin/AdminModuleHeader'
import AdminStatCard from '@/components/admin/AdminStatCard'
import EmptyState from '@/components/admin-users/EmptyState'
import RoleBadge from '@/components/admin-users/RoleBadge'
import UsuarioFilterChips from '@/components/admin-users/UsuarioFilterChips'
import UsuarioSearchBar from '@/components/admin-users/UsuarioSearchBar'
import UsuarioSummaryHeader from '@/components/admin-users/UsuarioSummaryHeader'
import ResponsiveDetailSection from '@/components/branches/ResponsiveDetailSection'
import StatusBadge from '@/components/branches/StatusBadge'

interface BranchDoc {
  id: string
  name: string
  type: 'sede' | 'rutas'
}

interface AppUser {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  allowedBranchIds: string[] | null
}

type UserFilter = 'all' | 'master' | 'manager' | 'operator' | 'user'

const ROLE_OPTIONS = [
  { value: 'user', label: 'Usuario', description: 'Acceso estándar a la aplicación.' },
  { value: 'operator', label: 'Operador', description: 'Gestión diaria de clientes y préstamos.' },
  { value: 'manager', label: 'Gerente', description: 'Supervisión operativa sin privilegios maestros.' },
] as const

const FILTER_ITEMS: { id: UserFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'manager', label: 'Gerentes' },
  { id: 'operator', label: 'Operadores' },
  { id: 'user', label: 'Usuarios' },
  { id: 'master', label: 'Maestro' },
]

const BRANCH_TYPE_LABEL: Record<'sede' | 'rutas', string> = {
  sede: 'Sucursal',
  rutas: 'Ruta',
}

function formatDate(value: string) {
  if (!value) return 'No disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No disponible'
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function accessSummary(user: AppUser, branches: BranchDoc[]) {
  if (user.role === 'master') return 'Acceso total institucional'
  if (user.allowedBranchIds === null) return 'Todas las sucursales'
  if (user.allowedBranchIds.length === 0) return 'Sin acceso asignado'
  if (user.allowedBranchIds.length === 1) {
    const branch = branches.find((item) => item.id === user.allowedBranchIds?.[0])
    return branch ? branch.name : 'No disponible'
  }
  return `${user.allowedBranchIds.length} sucursales asignadas`
}

function FormField({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: React.ReactNode
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block break-words text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
      {helper ? <span className="mt-2 block break-words text-xs leading-5 text-slate-500">{helper}</span> : null}
    </label>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function UserCard({
  user,
  branches,
  selected,
  onSelect,
  onDelete,
}: {
  user: AppUser
  branches: BranchDoc[]
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const isMaster = user.role === 'master'
  const accessLabel = accessSummary(user, branches)

  return (
    <article
      className={`min-w-0 overflow-hidden rounded-[28px] border bg-white transition ${
        selected ? 'border-blue-300 shadow-[0_20px_45px_rgba(21,101,192,.14)]' : 'border-slate-200 shadow-[0_14px_32px_rgba(15,23,42,.05)]'
      }`}
    >
      <button type="button" onClick={onSelect} className="block w-full min-w-0 px-4 py-4 text-left sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1565C0,#0D2B5E)] text-sm font-black text-white">
            {(user.name.trim() || user.email.trim() || 'US').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="min-w-0 flex-1 break-words text-base font-black leading-tight text-slate-950">{user.name || 'Usuario'}</h3>
              <RoleBadge role={user.role} />
              <StatusBadge label="Activo" tone={isMaster ? 'warning' : 'success'} />
            </div>
            <p className="mt-2 break-all text-sm text-slate-600">{user.email || 'No disponible'}</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Acceso</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-900">{accessLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Alta</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-900">{formatDate(user.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </button>
      <div className="flex flex-col gap-3 border-t border-slate-200/80 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
            {user.allowedBranchIds && user.allowedBranchIds.length === 1 ? 'Sucursal asociada' : 'Cobertura'}: {accessLabel}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={onSelect} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Ver detalle
          </button>
          {!isMaster ? (
            <button type="button" onClick={onDelete} className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100">
              Eliminar
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [users, setUsers] = useState<AppUser[]>([])
  const [branches, setBranches] = useState<BranchDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<UserFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'user' })
  const [createBranches, setCreateBranches] = useState<string[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState('')
  const [createOk, setCreateOk] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [resetErr, setResetErr] = useState('')
  const [resetOk, setResetOk] = useState('')
  const [resetting, setResetting] = useState(false)
  const [roleSaving, setRoleSaving] = useState(false)
  const [roleOk, setRoleOk] = useState('')
  const [branchDraft, setBranchDraft] = useState<string[] | null>(null)
  const [branchSaving, setBranchSaving] = useState(false)
  const [branchOk, setBranchOk] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'master') router.replace('/')
  }, [session, status, router])

  useEffect(() => {
    if (session?.user.role !== 'master') return
    Promise.all([
      fetch('/api/admin/users').then((response) => response.json()),
      fetch('/api/admin/branches').then((response) => response.json()).catch(() => ({ branches: [] })),
    ])
      .then(([userData, branchData]) => {
        setUsers(userData.users ?? [])
        setBranches(branchData.branches ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('No se pudo cargar la lista de usuarios.')
        setLoading(false)
      })
  }, [session])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users.filter((user) => {
      const matchesFilter = filter === 'all' || user.role === filter
      const matchesSearch = !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
      return matchesFilter && matchesSearch
    })
  }, [filter, search, users])

  const selectedUser = useMemo(() => users.find((user) => user.id === selectedId) ?? null, [selectedId, users])

  useEffect(() => {
    if (!selectedUser) return
    setBranchDraft(selectedUser.allowedBranchIds)
    setRoleOk('')
    setBranchOk('')
    setResetErr('')
    setResetOk('')
    setNewPwd('')
  }, [selectedUser])

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreateErr('')
    setCreateOk('')

    if (createForm.password.length < 8) {
      setCreateErr('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (createForm.password !== createForm.confirm) {
      setCreateErr('Las contraseñas no coinciden.')
      return
    }

    setCreating(true)
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
        allowedBranchIds: createBranches,
      }),
    })
    const data = await response.json()
    setCreating(false)

    if (!response.ok) {
      setCreateErr(data.error ?? 'No se pudo crear el usuario.')
      return
    }

    setUsers((current) => [...current, data.user])
    setSelectedId(data.user.id)
    setCreateForm({ name: '', email: '', password: '', confirm: '', role: 'user' })
    setCreateBranches(null)
    setCreateOk('Usuario creado correctamente.')
  }

  const handleDelete = async (user: AppUser) => {
    if (!confirm(`¿Eliminar el usuario "${user.name || user.email}"? Esta acción no se puede deshacer.`)) return
    const response = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    if (!response.ok) return
    setUsers((current) => current.filter((item) => item.id !== user.id))
    if (selectedId === user.id) setSelectedId(null)
  }

  const handleResetPassword = async () => {
    if (!selectedUser) return
    setResetErr('')
    setResetOk('')
    if (newPwd.length < 8) {
      setResetErr('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setResetting(true)
    const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPwd }),
    })
    setResetting(false)

    if (!response.ok) {
      const data = await response.json()
      setResetErr(data.error ?? 'No se pudo actualizar la contraseña.')
      return
    }

    setNewPwd('')
    setResetOk('Contraseña actualizada correctamente.')
  }

  const handleRoleChange = async (role: string) => {
    if (!selectedUser || selectedUser.role === 'master' || selectedUser.role === role) return
    setRoleSaving(true)
    const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    setRoleSaving(false)
    if (!response.ok) return
    setUsers((current) => current.map((user) => (user.id === selectedUser.id ? { ...user, role } : user)))
    setRoleOk('Rol actualizado correctamente.')
  }

  const handleBranchSave = async () => {
    if (!selectedUser || selectedUser.role === 'master') return
    setBranchSaving(true)
    const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedBranchIds: branchDraft }),
    })
    setBranchSaving(false)
    if (!response.ok) return
    setUsers((current) => current.map((user) => (user.id === selectedUser.id ? { ...user, allowedBranchIds: branchDraft } : user)))
    setBranchOk('Acceso actualizado correctamente.')
  }

  const toggleBranchDraft = (branchId: string) => {
    setBranchDraft((current) => {
      if (current === null) return [branchId]
      if (current.includes(branchId)) {
        const next = current.filter((id) => id !== branchId)
        return next.length === 0 ? null : next
      }
      return [...current, branchId]
    })
  }

  const toggleCreateBranch = (branchId: string) => {
    setCreateBranches((current) => {
      if (current === null) return [branchId]
      if (current.includes(branchId)) return current.filter((id) => id !== branchId)
      return [...current, branchId]
    })
  }

  if (status === 'loading' || session?.user.role !== 'master') return null

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminModuleHeader
        eyebrow="Administración de usuarios"
        title="Gestionar usuarios"
        description="Controla roles, cobertura por sucursal y credenciales desde una experiencia móvil más clara, segura y confiable para operación financiera."
        actions={[
          {
            id: 'create',
            label: 'Nuevo usuario',
            tone: 'primary',
            onClick: () => {
              document.getElementById('crear-usuario')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            },
          },
          { id: 'branches', label: 'Sucursales', href: '/admin/branches', tone: 'secondary' },
          { id: 'app', label: 'Volver a la app', href: '/app', tone: 'secondary' },
        ]}
        stats={
          <>
            <AdminStatCard label="Usuarios" value={String(users.length)} helper="Cuentas registradas en la organización." />
            <AdminStatCard
              label="Operación"
              value={String(users.filter((user) => user.role === 'manager' || user.role === 'operator').length)}
              helper="Usuarios con funciones operativas activas."
            />
            <AdminStatCard
              label="Cobertura total"
              value={String(users.filter((user) => user.allowedBranchIds === null).length)}
              helper="Cuentas con acceso a todas las sucursales."
            />
          </>
        }
        toolbar={
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <UsuarioSearchBar value={search} onChange={setSearch} placeholder="Buscar usuario por nombre o correo" />
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-100/80">Filtrar por rol</p>
              <UsuarioFilterChips items={FILTER_ITEMS} active={filter} onChange={(value) => setFilter(value as UserFilter)} />
            </div>
          </div>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,.85fr)]">
          <div className="min-w-0 space-y-6">
            <ResponsiveDetailSection
              eyebrow="Listado"
              title="Usuarios registrados"
              description="Encuentra rápido cada cuenta, comprende su rol y cobertura en segundos y abre el detalle sin fricción."
            >
              {loading ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Cargando usuarios...</div>
              ) : error ? (
                <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700">{error}</div>
              ) : filteredUsers.length === 0 ? (
                <EmptyState title="No hay usuarios para este filtro" description="Ajusta la búsqueda o crea un nuevo usuario desde el panel lateral." />
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {filteredUsers.map((user) => (
                    <UserCard key={user.id} user={user} branches={branches} selected={selectedId === user.id} onSelect={() => setSelectedId(user.id)} onDelete={() => handleDelete(user)} />
                  ))}
                </div>
              )}
            </ResponsiveDetailSection>
          </div>

          <div className="min-w-0 space-y-6">
            <div id="crear-usuario">
              <ResponsiveFormSection eyebrow="Nuevo usuario" title="Crear usuario operativo" description="Define identidad, rol, credenciales y cobertura territorial en un formulario más claro para móvil.">
                <form onSubmit={handleCreate} className="min-w-0">
                  <div className="grid grid-cols-1 gap-4">
                    <FormField label="Nombre completo">
                      <input
                        type="text"
                        value={createForm.name}
                        onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Ej: Laura Díaz"
                        className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                      />
                    </FormField>
                    <FormField label="Correo electrónico">
                      <input
                        type="email"
                        required
                        value={createForm.email}
                        onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                        placeholder="usuario@empresa.com"
                        className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                      />
                    </FormField>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField label="Contraseña" helper="Mínimo 8 caracteres.">
                        <input
                          type="password"
                          required
                          value={createForm.password}
                          onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                          placeholder="••••••••"
                          className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                        />
                      </FormField>
                      <FormField label="Confirmar contraseña">
                        <input
                          type="password"
                          required
                          value={createForm.confirm}
                          onChange={(event) => setCreateForm((current) => ({ ...current, confirm: event.target.value }))}
                          placeholder="••••••••"
                          className={`min-h-12 w-full rounded-2xl border bg-slate-50 px-4 text-sm text-slate-700 outline-none transition ${
                            createForm.confirm && createForm.confirm !== createForm.password ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-blue-400'
                          }`}
                        />
                      </FormField>
                    </div>

                    <FormField label="Rol" helper="Selecciona el nivel de operación que tendrá el usuario.">
                      <div className="grid grid-cols-1 gap-2">
                        {ROLE_OPTIONS.map((option) => {
                          const active = createForm.role === option.value
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setCreateForm((current) => ({ ...current, role: option.value }))}
                              className={`min-h-12 rounded-2xl border px-4 py-3 text-left transition ${
                                active ? 'border-blue-300 bg-blue-50 shadow-[0_12px_24px_rgba(15,23,42,.06)]' : 'border-slate-200 bg-slate-50 hover:bg-white'
                              }`}
                            >
                              <span className="block text-sm font-bold text-slate-900">{option.label}</span>
                              <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                            </button>
                          )
                        })}
                      </div>
                    </FormField>

                    {branches.length > 0 ? (
                      <FormField label="Acceso a sucursales" helper="Deja acceso total o selecciona sucursales específicas para la operación.">
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setCreateBranches(null)}
                            className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 text-left text-sm font-semibold transition ${
                              createBranches === null ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                            }`}
                          >
                            <span className="flex-1">Todas las sucursales</span>
                            {createBranches === null ? '✓' : ''}
                          </button>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {branches.map((branch) => {
                              const checked = createBranches !== null && createBranches.includes(branch.id)
                              return (
                                <button
                                  key={branch.id}
                                  type="button"
                                  onClick={() => toggleCreateBranch(branch.id)}
                                  className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 text-left text-sm font-semibold transition ${
                                    checked ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="block break-words">{branch.name}</span>
                                    <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-slate-400">{BRANCH_TYPE_LABEL[branch.type]}</span>
                                  </div>
                                  {checked ? '✓' : ''}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </FormField>
                    ) : null}
                  </div>

                  {createErr ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{createErr}</div> : null}
                  {createOk ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{createOk}</div> : null}

                  <ResponsiveActionBar>
                    <button
                      type="submit"
                      disabled={creating || !createForm.email || !createForm.password || createForm.password !== createForm.confirm}
                      className="min-h-12 rounded-2xl bg-[linear-gradient(135deg,#0D2B5E,#1565C0)] px-5 text-sm font-bold text-white shadow-[0_18px_34px_rgba(21,101,192,.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creating ? 'Creando...' : 'Crear usuario'}
                    </button>
                  </ResponsiveActionBar>
                </form>
              </ResponsiveFormSection>
            </div>

            <ResponsiveDetailSection
              eyebrow="Detalle y edición"
              title={selectedUser ? 'Perfil de usuario' : 'Selecciona un usuario'}
              description={
                selectedUser
                  ? 'Revisa identidad, rol, cobertura y seguridad desde un panel más claro para operación diaria.'
                  : 'Selecciona un usuario desde el listado para revisar el detalle, editar su rol o ajustar acceso a sucursales.'
              }
            >
              {selectedUser ? (
                <div className="space-y-6">
                  <UsuarioSummaryHeader name={selectedUser.name} email={selectedUser.email} role={selectedUser.role} accessLabel={accessSummary(selectedUser, branches)} />

                  <ResponsiveFormSection eyebrow="Información general" title="Datos del usuario" description="Resumen de identidad y contexto operativo visible de inmediato.">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DetailField label="Nombre" value={selectedUser.name || 'Usuario'} />
                      <DetailField label="Correo" value={selectedUser.email || 'No disponible'} />
                      <DetailField label="Alta" value={formatDate(selectedUser.createdAt)} />
                      <DetailField label="Estado" value="Activo" />
                    </div>
                  </ResponsiveFormSection>

                  {selectedUser.role === 'master' ? (
                    <EmptyState title="Cuenta maestra" description="La cuenta maestra conserva acceso completo y no admite cambios de rol, acceso territorial ni eliminación desde este módulo." />
                  ) : (
                    <>
                      <ResponsiveFormSection eyebrow="Rol y permisos" title="Actualizar rol" description="Cambia el nivel operativo con una acción clara y fácil de validar en móvil.">
                        <div className="grid grid-cols-1 gap-2">
                          {ROLE_OPTIONS.map((option) => {
                            const active = selectedUser.role === option.value
                            return (
                              <button
                                key={option.value}
                                type="button"
                                disabled={roleSaving}
                                onClick={() => handleRoleChange(option.value)}
                                className={`min-h-12 rounded-2xl border px-4 py-3 text-left transition ${
                                  active ? 'border-blue-300 bg-blue-50 shadow-[0_12px_24px_rgba(15,23,42,.06)]' : 'border-slate-200 bg-slate-50 hover:bg-white'
                                } ${roleSaving ? 'cursor-wait opacity-70' : ''}`}
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-bold text-slate-900">{option.label}</span>
                                  {active ? <StatusBadge label="Actual" tone="info" /> : null}
                                </div>
                                <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                              </button>
                            )
                          })}
                        </div>
                        {roleOk ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{roleOk}</div> : null}
                      </ResponsiveFormSection>

                      <ResponsiveFormSection eyebrow="Sucursal asociada" title="Cobertura y acceso" description="Define si el usuario opera en toda la red o solo en sucursales específicas.">
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setBranchDraft(null)}
                            className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 text-left text-sm font-semibold transition ${
                              branchDraft === null ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                            }`}
                          >
                            <span className="flex-1">Todas las sucursales</span>
                            {branchDraft === null ? '✓' : ''}
                          </button>

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {branches.map((branch) => {
                              const checked = branchDraft !== null && branchDraft.includes(branch.id)
                              return (
                                <button
                                  key={branch.id}
                                  type="button"
                                  onClick={() => toggleBranchDraft(branch.id)}
                                  className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 text-left text-sm font-semibold transition ${
                                    checked ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="block break-words">{branch.name}</span>
                                    <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-slate-400">{BRANCH_TYPE_LABEL[branch.type]}</span>
                                  </div>
                                  {checked ? '✓' : ''}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        {branchOk ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{branchOk}</div> : null}
                        <ResponsiveActionBar>
                          <button
                            type="button"
                            onClick={handleBranchSave}
                            disabled={branchSaving}
                            className="min-h-12 rounded-2xl bg-[linear-gradient(135deg,#0D2B5E,#1565C0)] px-5 text-sm font-bold text-white shadow-[0_18px_34px_rgba(21,101,192,.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {branchSaving ? 'Guardando...' : 'Guardar acceso'}
                          </button>
                        </ResponsiveActionBar>
                      </ResponsiveFormSection>

                      <ResponsiveFormSection eyebrow="Seguridad" title="Restablecer contraseña" description="Actualiza la contraseña en una sección separada para reducir errores operativos.">
                        <div className="space-y-4">
                          <FormField label="Nueva contraseña" helper="Mínimo 8 caracteres.">
                            <input
                              type="password"
                              value={newPwd}
                              onChange={(event) => setNewPwd(event.target.value)}
                              placeholder="••••••••"
                              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                            />
                          </FormField>
                          {resetErr ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{resetErr}</div> : null}
                          {resetOk ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{resetOk}</div> : null}
                        </div>
                        <ResponsiveActionBar>
                          <button
                            type="button"
                            onClick={handleResetPassword}
                            disabled={resetting || newPwd.length < 8}
                            className="min-h-12 rounded-2xl bg-[linear-gradient(135deg,#0D2B5E,#1565C0)] px-5 text-sm font-bold text-white shadow-[0_18px_34px_rgba(21,101,192,.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {resetting ? 'Guardando...' : 'Guardar contraseña'}
                          </button>
                        </ResponsiveActionBar>
                      </ResponsiveFormSection>

                      <ResponsiveFormSection eyebrow="Acciones" title="Gestión de cuenta" description="Acciones críticas separadas del resto para una edición más segura.">
                        <button type="button" onClick={() => handleDelete(selectedUser)} className="min-h-12 w-full rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100">
                          Eliminar usuario
                        </button>
                      </ResponsiveFormSection>
                    </>
                  )}
                </div>
              ) : (
                <EmptyState title="Sin usuario seleccionado" description="Selecciona un usuario desde la lista para revisar el detalle, ajustar el rol o gestionar acceso a sucursales." />
              )}
            </ResponsiveDetailSection>
          </div>
        </div>
      </main>
    </div>
  )
}
