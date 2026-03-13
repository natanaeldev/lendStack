'use client'

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4.5 w-4.5">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

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
    <div className="w-full min-w-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,.06)]">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="shrink-0 text-slate-400" aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Buscar por nombre, cédula o teléfono"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="min-h-11 shrink-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 sm:px-5"
          >
            Limpiar
          </button>
        ) : null}
      </div>
      <p className="px-1 pt-2 text-xs text-slate-500">{resultsLabel}</p>
    </div>
  )
}
