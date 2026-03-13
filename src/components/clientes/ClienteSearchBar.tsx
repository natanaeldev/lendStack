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
    <div className="w-full min-w-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white p-3.5 shadow-[0_16px_40px_rgba(15,23,42,.06)] sm:p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{'B\u00fasqueda r\u00e1pida'}</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-700">{'Encontr\u00e1 clientes por nombre, c\u00e9dula o tel\u00e9fono'}</p>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">{resultsLabel}</span>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="shrink-0 text-slate-400" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={'Buscar por nombre, c\u00e9dula o tel\u00e9fono'}
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>
          {value ? (
            <button
              type="button"
              onClick={() => onChange('')}
              className="min-h-[52px] w-full shrink-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 sm:w-auto sm:px-5"
            >
              Limpiar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
