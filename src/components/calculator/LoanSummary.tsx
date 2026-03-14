'use client'

export default function LoanSummary({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,.06)]">
      <p className="break-words text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Resumen del préstamo</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3.5">
            <p className="break-words text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
            <p className="mt-1 break-words whitespace-normal text-sm font-semibold leading-6 text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
