'use client'

export default function AdminStatCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100/80">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm leading-6 text-blue-100/90">{helper}</p>
    </div>
  )
}
