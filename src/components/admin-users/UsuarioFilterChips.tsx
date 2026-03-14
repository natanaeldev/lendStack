'use client'

type FilterChip = {
  id: string
  label: string
}

export default function UsuarioFilterChips({
  items,
  active,
  onChange,
}: {
  items: FilterChip[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${
            active === item.id
              ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-[0_8px_20px_rgba(37,99,235,.12)]'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
