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
      className="min-w-0 rounded-[26px] border px-4 py-4"
      style={{
        background: tone.background,
        borderColor: tone.border,
        color: tone.color,
      }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">{label}</p>
      <p className="mt-1 break-words text-xl font-semibold sm:text-2xl">{value}</p>
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
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="inline-flex max-w-full items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Clientes</div>
          <h1 className="mt-3 max-w-xl break-words font-display text-2xl leading-tight text-slate-950 sm:text-3xl">Cartera lista para operar desde el celular</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{'Busc\u00e1 r\u00e1pido, identific\u00e1 estatus al instante y abr\u00ed el detalle del cliente con un solo toque.'}</p>
          <div className="mt-4 inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
            {storageMode === 'cloud'
              ? 'Sincronizado en la nube'
              : storageMode === 'local'
                ? 'Guardado local'
                : 'Cargando datos'}
          </div>
        </div>

        <div className="hidden sm:block sm:self-start">
          <NewClienteButton label="Nuevo cliente" onClick={onCreate} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Total" value={totalClients} tone={{ background: '#FFFFFF', border: '#E2E8F0', color: '#0F172A' }} />
        <MetricCard label="Activos" value={activeClients} tone={{ background: '#ECFDF5', border: '#86EFAC', color: '#166534' }} />
        <MetricCard label="Morosos" value={delinquentClients} tone={{ background: '#FEF2F2', border: '#FCA5A5', color: '#B91C1C' }} />
        <MetricCard label={'En evaluaci\u00f3n'} value={pendingClients} tone={{ background: '#FFFBEB', border: '#FCD34D', color: '#92400E' }} />
      </div>
    </section>
  )
}
