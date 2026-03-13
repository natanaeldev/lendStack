'use client'

import type { ClientFilterKey } from './helpers'

const FILTERS: { key: ClientFilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'delinquent', label: 'Morosos' },
  { key: 'no-loan', label: 'Sin préstamo' },
]

export default function ClienteFilterChips({
  value,
  onChange,
}: {
  value: ClientFilterKey
  onChange: (value: ClientFilterKey) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {FILTERS.map((filter) => {
        const active = value === filter.key
        return (
          <button
            key={filter.key}
            type="button"
            onClick={() => onChange(filter.key)}
            className="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition"
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
  )
}
