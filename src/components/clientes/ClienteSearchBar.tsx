'use client'

export default function ClienteSearchBar({
  value,
  onChange,
  resultsLabel,
}: {
  value: string
  onChange: (value: string) => void
  resultsLabel: string
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,.06)]">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-lg text-slate-400" aria-hidden="true">
          ⌕
        </span>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Buscar por nombre, cédula o teléfono"
          className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
          >
            Limpiar
          </button>
        ) : null}
      </div>
      <p className="px-1 pt-2 text-xs text-slate-500">{resultsLabel}</p>
    </div>
  )
}
