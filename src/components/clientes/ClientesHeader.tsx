'use client'

import NewClienteButton from './NewClienteButton'
import type { StorageMode } from './helpers'

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: { background: string; border: string; color: string }
}) {
  return (
    <div
      className="rounded-3xl border px-4 py-4"
      style={{
        background: tone.background,
        borderColor: tone.border,
        color: tone.color,
      }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

export default function ClientesHeader({
  totalClients,
  activeClients,
  delinquentClients,
  pendingClients,
  storageMode,
  onCreate,
}: {
  totalClients: number
  activeClients: number
  delinquentClients: number
  pendingClients: number
  storageMode: StorageMode
  onCreate: () => void
}) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#F8FBFF_0%,#FFFFFF_50%,#F8FAFC_100%)] p-4 sm:p-6 shadow-[0_20px_48px_rgba(15,23,42,.06)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Clientes</p>
          <h1 className="mt-2 font-display text-2xl text-slate-950 sm:text-3xl">Cartera lista para operar desde el celular</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            Buscá rápido, identificá estatus al instante y abrí el detalle del cliente con un solo toque.
          </p>
          <div className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
            {storageMode === 'cloud'
              ? 'Sincronizado en la nube'
              : storageMode === 'local'
                ? 'Guardado local'
                : 'Cargando datos'}
          </div>
        </div>

        <div className="hidden sm:block">
          <NewClienteButton label="Nuevo cliente" onClick={onCreate} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total" value={totalClients} tone={{ background: '#FFFFFF', border: '#E2E8F0', color: '#0F172A' }} />
        <MetricCard label="Activos" value={activeClients} tone={{ background: '#ECFDF5', border: '#86EFAC', color: '#166534' }} />
        <MetricCard label="Morosos" value={delinquentClients} tone={{ background: '#FEF2F2', border: '#FCA5A5', color: '#B91C1C' }} />
        <MetricCard label="En evaluación" value={pendingClients} tone={{ background: '#FFFBEB', border: '#FCD34D', color: '#92400E' }} />
      </div>
    </section>
  )
}
