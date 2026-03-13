'use client'

import type { ClientFilterKey } from './helpers'

const FILTERS: { key: ClientFilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'delinquent', label: 'Morosos' },
  { key: 'no-loan', label: 'Sin pr\u00e9stamo' },
]

export default function ClienteFilterChips({
  value,
  onChange,
}: {
  value: ClientFilterKey
  onChange: (value: ClientFilterKey) => void
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white p-2.5 shadow-[0_16px_40px_rgba(15,23,42,.06)]">
      <div className="flex gap-2 overflow-x-auto px-0.5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((filter) => {
          const active = value === filter.key
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => onChange(filter.key)}
              className="min-h-11 shrink-0 whitespace-nowrap rounded-2xl border px-4 py-2 text-sm font-semibold transition"
              style={{
                borderColor: active ? '#1D4ED8' : '#CBD5E1',
                background: active ? '#0D2B5E' : '#FFFFFF',
                color: active ? '#FFFFFF' : '#475569',
                boxShadow: active ? '0 10px 20px rgba(13,43,94,.16)' : 'none',
              }}
            >
              {filter.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
