'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import ResponsiveActionBar from '@/components/admin-branches/ResponsiveActionBar'
import ResponsiveFormSection from '@/components/admin-branches/ResponsiveFormSection'
import AdminModuleHeader from '@/components/admin/AdminModuleHeader'
import AdminStatCard from '@/components/admin/AdminStatCard'
import ResponsiveDetailSection from '@/components/branches/ResponsiveDetailSection'
import StatusBadge from '@/components/branches/StatusBadge'
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

function formatDate(value: string) {
  if (!value) return 'No disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No disponible'
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
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
    <article
      className={`min-w-0 overflow-hidden rounded-[28px] border bg-white transition ${
        isActive ? 'border-blue-300 shadow-[0_20px_45px_rgba(21,101,192,.14)]' : 'border-slate-200 shadow-[0_14px_32px_rgba(15,23,42,.05)]'
      }`}
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
            <p className="mt-2 break-words text-sm leading-6 text-slate-600">
              Registro territorial listo para asignación operativa y administración institucional.
            </p>
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

      <div className="flex flex-col gap-3 border-t border-slate-200/80 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Ubicación: No disponible</span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Responsable: No disponible</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" onClick={onView} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Ver detalle
          </button>
          <button type="button" onClick={onEdit} className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
            Editar
          </button>
          <button type="button" onClick={onDelete} className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100">
            Eliminar
          </button>
        </div>
      </div>

      {deleteError ? <p className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-5">{deleteError}</p> : null}
    </article>
  )
}

export default function AdminBranchesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const canAccessAdmin = session?.user?.role === 'master' || session?.user?.isOrganizationOwner

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
    if (!session || !canAccessAdmin) router.replace('/')
  }, [canAccessAdmin, session, status, router])

  useEffect(() => {
    if (!canAccessAdmin) return
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
  }, [canAccessAdmin, session])

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

  if (status === 'loading' || !canAccessAdmin) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminModuleHeader
        eyebrow="Administración de sucursales"
        title="Gestionar sucursales y rutas"
        description="Mantén la estructura territorial clara desde una cabecera móvil bien jerarquizada, con acceso inmediato a crear, buscar y filtrar registros sin saturar la pantalla."
        actions={[
          {
            id: 'create',
            label: 'Nueva sucursal',
            tone: 'primary',
            onClick: () => {
              resetCreateForm()
              setFormSuccess('')
            },
          },
          { id: 'users', label: 'Usuarios', href: '/admin/users', tone: 'secondary' },
          { id: 'app', label: 'Volver a la app', href: '/app', tone: 'secondary' },
        ]}
        stats={
          <>
            <AdminStatCard label="Sucursales" value={String(sedeCount)} helper="Oficinas principales registradas." />
            <AdminStatCard label="Rutas" value={String(rutasCount)} helper="Cobertura operativa activa." />
            <AdminStatCard label="Total" value={String(branches.length)} helper="Registros listos para administración." />
          </>
        }
        toolbar={
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="block min-w-0">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-blue-100/80">Buscar registro</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar sucursal o ruta"
                className="min-h-12 w-full rounded-2xl border border-white/10 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300"
              />
            </label>
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
                  className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${
                    filter === item.id
                      ? 'border-white bg-white text-slate-900'
                      : 'border-white/15 bg-white/8 text-white hover:bg-white/15'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
          <div className="min-w-0 space-y-6">
            <ResponsiveDetailSection
              eyebrow="Listado"
              title="Sucursales y rutas registradas"
              description="El listado prioriza lectura rápida en móvil, sin barras horizontales forzadas ni acciones comprimidas."
              actions={
                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm()
                    setFormSuccess('')
                  }}
                  className="min-h-11 w-full rounded-2xl bg-[linear-gradient(135deg,#0D2B5E,#1565C0)] px-4 text-sm font-bold text-white shadow-[0_18px_34px_rgba(21,101,192,.24)] sm:w-auto"
                >
                  Nueva sucursal
                </button>
              }
            >
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
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
              title={editorMode === 'edit' ? 'Actualiza el registro seleccionado' : 'Crear registro territorial'}
              description={
                editorMode === 'edit'
                  ? 'Modifica nombre y tipo con un flujo seguro, claro y cómodo en pantallas pequeñas.'
                  : 'Crea una nueva sucursal o ruta. Los datos de contacto y ubicación todavía no forman parte del modelo actual.'
              }
            >
              <form onSubmit={handleSubmit} className="min-w-0">
                <div className="grid grid-cols-1 gap-4">
                  <FormField label="Nombre de la sucursal" helper="Usa un nombre operativo y reconocible, por ejemplo Sede Central o Ruta Norte.">
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Ej: Sede Central"
                      className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                    />
                  </FormField>

                  <FormField label="Tipo" helper="Define si el registro funciona como sucursal principal o como ruta operativa.">
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
                    <button type="button" onClick={resetCreateForm} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Cancelar edición
                    </button>
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
              description={
                selectedBranch
                  ? 'Resumen del registro seleccionado con información general y estado administrativo.'
                  : 'Abre un registro desde la lista para revisar su detalle o iniciar edición con un solo toque.'
              }
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
                      <p className="mt-2 break-words text-sm leading-6 text-slate-500">
                        Registro administrativo disponible para asignación operativa y mantenimiento institucional.
                      </p>
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
                      <p className="mt-1 break-words text-sm leading-6 text-slate-600">
                        Este módulo administra el registro maestro de sucursales y rutas. Los datos de contacto y ubicación aún no forman parte del modelo actual.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => openEdit(selectedBranch)} className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
                      Editar
                    </button>
                    <button type="button" onClick={() => handleDelete(selectedBranch)} className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100">
                      Eliminar
                    </button>
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
