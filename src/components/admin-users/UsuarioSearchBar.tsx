'use client'

export default function UsuarioSearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Buscar</span>
      <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,.65)] transition focus-within:border-blue-400 focus-within:bg-white">
        <span className="text-sm text-slate-400">⌕</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />
      </div>
    </label>
  )
}
