'use client'
import { Currency, CURRENCIES } from '@/lib/loan'

interface Props { value: Currency; onChange: (c: Currency) => void }

export default function CurrencyToggle({ value, onChange }: Props) {
  return (
    <div className="flex rounded-xl overflow-hidden border-2 border-slate-200">
      {(Object.keys(CURRENCIES) as Currency[]).map((cur) => {
        const c = CURRENCIES[cur]
        const active = value === cur
        return (
          <button
            key={cur}
            onClick={() => onChange(cur)}
            className="px-3 py-2 text-xs font-bold transition-all"
            style={{ background: active ? '#1565C0' : '#fff', color: active ? '#fff' : '#64748b', fontFamily: "'DM Sans', sans-serif" }}
          >
            {c.flag} {c.label}
          </button>
        )
      })}
    </div>
  )
}
