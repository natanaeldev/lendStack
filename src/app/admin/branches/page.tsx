'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import LendStackLogo from '@/components/LendStackLogo'
import ResponsiveDetailSection from '@/components/branches/ResponsiveDetailSection'
import StatusBadge from '@/components/branches/StatusBadge'
import ResponsiveActionBar from '@/components/admin-branches/ResponsiveActionBar'
import ResponsiveFormSection from '@/components/admin-branches/ResponsiveFormSection'
import type { Branch } from '@/lib/loan'

interface BranchDoc {
  id: string
  name: string
  type: Branch
  createdAt: string
}

type FilterValue = 'all' | Branch

type EditorMode = 'create' | 'edit'

type FormState = {
  name: string
  type: Branch
}

const TYPE_CFG: Record<Branch, { label: string; icon: string; accent: string; surface: string; soft: string }> = {
  sede: { label: 'Sucursal', icon: '🏢', accent: '#1565C0', surface: 'linear-gradient(180deg,#F8FBFF 0%,#FFFFFF 100%)', soft: '#DBEAFE' },
  rutas: { label: 'Ruta', icon: '🛣️', accent: '#C2410C', surface: 'linear-gradient(180deg,#FFF9F4 0%,#FFFFFF 100%)', soft: '#FED7AA' },
}

function formatDate(iso: string) {
  if (!iso) return 'No disponible'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'No disponible'
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function emptyValue(value?: string | null) {
  if (!value) return '—'
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : '—'
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

function BranchCard({
  branch,
  isActive,
  onView,
  onEdit,
  onDelete,
  deleteError,
}: {
  branch: BranchDoc
  isActive: boolean
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  deleteError?: string
}) {
  const tone = TYPE_CFG[branch.type]

  return (
    <div
      className={`min-w-0 overflow-hidden rounded-[28px] border bg-white transition ${isActive ? 'border-blue-300 shadow-[0_20px_45px_rgba(21,101,192,.14)]' : 'border-slate-200 shadow-[0_14px_32px_rgba(15,23,42,.05)]'}`}
      style={{ background: tone.surface }}
    >
      <button type="button" onClick={onView} className="block w-full min-w-0 px-4 py-4 text-left sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: tone.soft }}>
            {tone.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="min-w-0 flex-1 break-words text-base font-black leading-tight text-slate-950">{branch.name}</h3>
              <StatusBadge label={tone.label} tone={branch.type === 'sede' ? 'info' : 'warning'} />
            </div>
            <p className="mt-2 break-words text-sm leading-6 text-slate-600">Registro operativo listo para asignación y administración institucional.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Estado</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Activo</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Creación</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-900">{formatDate(branch.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </button>

      <div className="flex flex-col gap-2 border-t border-slate-200/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="break-words text-xs font-semibold text-slate-500">Ubicación: No disponible</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onView} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Ver</button>
          <button type="button" onClick={onEdit} className="min-h-10 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">Editar</button>
          <button type="button" onClick={onDelete} className="min-h-10 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100">Eliminar</button>
        </div>
      </div>

      {deleteError ? <p className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-5">{deleteError}</p> : null}
    </div>
  )
}

export default function AdminBranchesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [branches, setBranches] = useState<BranchDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editorMode, setEditorMode] = useState<EditorMode>('create')
  const [form, setForm] = useState<FormState>({ name: '', type: 'sede' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [deleteErr, setDeleteErr] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'master') router.replace('/')
  }, [session, status, router])

  useEffect(() => {
    if (session?.user.role !== 'master') return
    fetch('/api/admin/branches')
      .then((response) => response.json())
      .then((data) => {
        setBranches(data.branches ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('No se pudo cargar la lista de sucursales.')
        setLoading(false)
      })
  }, [session])

  const selectedBranch = useMemo(() => branches.find((branch) => branch.id === selectedId) ?? null, [branches, selectedId])

  useEffect(() => {
    if (!selectedBranch || editorMode !== 'edit') return
    setForm({ name: selectedBranch.name, type: selectedBranch.type })
    setFormError('')
  }, [selectedBranch, editorMode])

  const filteredBranches = useMemo(() => {
    const query = search.trim().toLowerCase()
    return branches.filter((branch) => {
      const matchesFilter = filter === 'all' || branch.type === filter
      const matchesSearch = !query || branch.name.toLowerCase().includes(query)
      return matchesFilter && matchesSearch
    })
  }, [branches, filter, search])

  const sedeCount = branches.filter((branch) => branch.type === 'sede').length
  const rutasCount = branches.filter((branch) => branch.type === 'rutas').length

  const resetCreateForm = () => {
    setEditorMode('create')
    setSelectedId(null)
    setForm({ name: '', type: 'sede' })
    setFormError('')
  }

  const openEdit = (branch: BranchDoc) => {
    setSelectedId(branch.id)
    setEditorMode('edit')
    setForm({ name: branch.name, type: branch.type })
    setFormError('')
    setFormSuccess('')
  }

  const openDetail = (branch: BranchDoc) => {
    setSelectedId(branch.id)
    setEditorMode('edit')
    setForm({ name: branch.name, type: branch.type })
    setFormError('')
    setFormSuccess('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    setFormSuccess('')

    if (!form.name.trim()) {
      setFormError('El nombre es obligatorio.')
      return
    }

    setSubmitting(true)

    const isEditing = editorMode === 'edit' && selectedBranch
    const endpoint = isEditing ? `/api/admin/branches/${selectedBranch.id}` : '/api/admin/branches'
    const method = isEditing ? 'PATCH' : 'POST'

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), type: form.type }),
    })

    const data = await response.json()
    setSubmitting(false)

    if (!response.ok) {
      setFormError(data.error ?? (isEditing ? 'No se pudo actualizar la sucursal.' : 'No se pudo crear la sucursal.'))
      return
    }

    if (isEditing) {
      setBranches((current) => current.map((branch) => (branch.id === data.branch.id ? data.branch : branch)))
      setSelectedId(data.branch.id)
      setFormSuccess('Sucursal actualizada correctamente.')
    } else {
      setBranches((current) => [...current, data.branch])
      setSelectedId(data.branch.id)
      setEditorMode('edit')
      setForm({ name: data.branch.name, type: data.branch.type })
      setFormSuccess('Sucursal creada correctamente.')
    }
  }

  const handleDelete = async (branch: BranchDoc) => {
    if (!confirm(`¿Eliminar la sucursal "${branch.name}"? Esta acción no se puede deshacer.`)) return

    setDeleteErr((current) => ({ ...current, [branch.id]: '' }))
    const response = await fetch(`/api/admin/branches/${branch.id}`, { method: 'DELETE' })
    const data = await response.json()

    if (!response.ok) {
      setDeleteErr((current) => ({ ...current, [branch.id]: data.error ?? 'Error al eliminar.' }))
      return
    }

    setBranches((current) => current.filter((item) => item.id !== branch.id))
    if (selectedId === branch.id) resetCreateForm()
  }

  if (status === 'loading' || session?.user.role !== 'master') return null

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(135deg,#071A3E_0%,#0D2B5E_58%,#1565C0_100%)] shadow-[0_10px_40px_rgba(7,26,62,.25)]">
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <LendStackLogo variant="light" size={40} />
            <div className="min-w-0 border-l border-white/20 pl-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">Administración</p>
              <h1 className="mt-1 break-words text-2xl font-black leading-tight text-white">Gestión de sucursales</h1>
              <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-blue-100">Administra la estructura territorial con una vista clara para crear, editar y validar sucursales y rutas sin fricción.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/admin/users" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15">Usuarios</Link>
            <Link href="/app" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15">Volver a la app</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,.05)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Sucursales</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{sedeCount}</p>
            <p className="mt-1 text-sm text-slate-500">Oficinas principales registradas.</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,.05)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Rutas</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{rutasCount}</p>
            <p className="mt-1 text-sm text-slate-500">Cobertura operativa registrada.</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,.05)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Total</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{branches.length}</p>
            <p className="mt-1 text-sm text-slate-500">Registros listos para administración.</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
          <div className="min-w-0 space-y-6">
            <ResponsiveDetailSection
              eyebrow="Listado"
              title="Sucursales y rutas registradas"
              description="Busca por nombre, filtra por tipo y abre el registro adecuado rápidamente desde cualquier pantalla."
              actions={
                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm()
                    setFormSuccess('')
                  }}
                  className="min-h-11 w-full rounded-xl bg-[linear-gradient(135deg,#0D2B5E,#1565C0)] px-4 text-sm font-bold text-white shadow-[0_18px_34px_rgba(21,101,192,.24)] sm:w-auto"
                >
                  Nueva sucursal
                </button>
              }
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar sucursal o ruta"
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                />
                <div className="flex flex-wrap gap-2">
                  {([
                    { id: 'all', label: 'Todas' },
                    { id: 'sede', label: 'Sucursales' },
                    { id: 'rutas', label: 'Rutas' },
                  ] as { id: FilterValue; label: string }[]).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id)}
                      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${filter === item.id ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Cargando sucursales...</div>
              ) : error ? (
                <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700">{error}</div>
              ) : filteredBranches.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                  <p className="text-base font-semibold text-slate-900">No hay resultados para esta búsqueda.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Ajusta el término o cambia el filtro para revisar otros registros.</p>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {filteredBranches.map((branch) => (
                    <BranchCard
                      key={branch.id}
                      branch={branch}
                      isActive={selectedId === branch.id}
                      onView={() => openDetail(branch)}
                      onEdit={() => openEdit(branch)}
                      onDelete={() => handleDelete(branch)}
                      deleteError={deleteErr[branch.id]}
                    />
                  ))}
                </div>
              )}
            </ResponsiveDetailSection>
          </div>

          <div className="min-w-0 space-y-6">
            <ResponsiveFormSection
              eyebrow={editorMode === 'edit' ? 'Editar sucursal' : 'Nueva sucursal'}
              title={editorMode === 'edit' ? 'Actualiza el registro seleccionado' : 'Crea un nuevo registro territorial'}
              description={editorMode === 'edit' ? 'Modifica nombre y tipo del registro con una edición segura y clara.' : 'Actualmente el modelo permite definir nombre y tipo. Los datos de contacto y ubicación podrán ampliarse después.'}
            >
              <form onSubmit={handleSubmit} className="min-w-0">
                <div className="grid grid-cols-1 gap-4">
                  <FormField label="Nombre de la sucursal" helper="Usa un nombre claro y operativo, por ejemplo Sede Central o Ruta Norte.">
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Ej: Sede Central"
                      className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                    />
                  </FormField>

                  <FormField label="Tipo" helper="El tipo define si el registro se presenta como sucursal principal o ruta operativa.">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(['sede', 'rutas'] as Branch[]).map((branchType) => {
                        const tone = TYPE_CFG[branchType]
                        const active = form.type === branchType
                        return (
                          <button
                            key={branchType}
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, type: branchType }))}
                            className={`min-h-12 rounded-2xl border px-4 text-sm font-bold transition ${active ? 'shadow-[0_12px_24px_rgba(15,23,42,.08)]' : ''}`}
                            style={{
                              background: active ? tone.soft : '#F8FAFC',
                              color: active ? tone.accent : '#64748B',
                              borderColor: active ? tone.accent : '#E2E8F0',
                            }}
                          >
                            {tone.icon} {tone.label}
                          </button>
                        )
                      })}
                    </div>
                  </FormField>
                </div>

                {formError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div> : null}
                {formSuccess ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{formSuccess}</div> : null}

                <ResponsiveActionBar>
                  {editorMode === 'edit' ? (
                    <button type="button" onClick={resetCreateForm} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar edición</button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={submitting || !form.name.trim()}
                    className="min-h-12 rounded-2xl bg-[linear-gradient(135deg,#0D2B5E,#1565C0)] px-5 text-sm font-bold text-white shadow-[0_18px_34px_rgba(21,101,192,.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Guardando...' : editorMode === 'edit' ? 'Guardar cambios' : 'Crear sucursal'}
                  </button>
                </ResponsiveActionBar>
              </form>
            </ResponsiveFormSection>

            <ResponsiveDetailSection
              eyebrow="Detalle"
              title={selectedBranch ? selectedBranch.name : 'Selecciona una sucursal'}
              description={selectedBranch ? 'Resumen del registro seleccionado con información general y estado administrativo.' : 'Abre un registro desde la lista para revisar su detalle o comenzar a editarlo.'}
            >
              {selectedBranch ? (
                <div className="space-y-4">
                  <div className="flex min-w-0 items-start gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: TYPE_CFG[selectedBranch.type].soft }}>
                      {TYPE_CFG[selectedBranch.type].icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h2 className="min-w-0 flex-1 break-words text-lg font-black text-slate-950">{selectedBranch.name}</h2>
                        <StatusBadge label={TYPE_CFG[selectedBranch.type].label} tone={selectedBranch.type === 'sede' ? 'info' : 'warning'} />
                      </div>
                      <p className="mt-2 break-words text-sm leading-6 text-slate-500">Registro administrativo disponible para asignación operativa y mantenimiento institucional.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Nombre</p>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{selectedBranch.name}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Tipo</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{TYPE_CFG[selectedBranch.type].label}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Creación</p>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{formatDate(selectedBranch.createdAt)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Estado</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">Activo</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Dirección</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">No disponible</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Teléfono</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">No disponible</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Responsable</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">No disponible</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Resumen operativo</p>
                      <p className="mt-1 break-words text-sm leading-6 text-slate-600">Este módulo administra el registro maestro de sucursales y rutas. Los datos de contacto y ubicación aún no forman parte del modelo actual.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={() => openEdit(selectedBranch)} className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">Editar</button>
                    <button type="button" onClick={() => handleDelete(selectedBranch)} className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100">Eliminar</button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                  <p className="text-base font-semibold text-slate-900">Sin sucursal seleccionada</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Selecciona una tarjeta para ver el detalle o inicia un nuevo registro con la acción principal.</p>
                </div>
              )}
            </ResponsiveDetailSection>
          </div>
        </div>
      </main>
    </div>
  )
}
