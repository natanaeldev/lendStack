'use client'
import { RateMode } from '@/lib/loan'

interface Props { value: RateMode; onChange: (v: RateMode) => void }

const OPTIONS: { id: RateMode; label: string; emoji: string; desc: string }[] = [
  { id: 'annual',  emoji: '📅', label: 'Tasa anual',   desc: 'Perfil de riesgo define la tasa' },
  { id: 'monthly', emoji: '🗓️', label: 'Tasa mensual', desc: 'Ingresá la tasa mensual directa' },
]

export default function RateModeToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-xl border-2 border-slate-200 overflow-hidden bg-slate-50 p-0.5 gap-0.5">
      {OPTIONS.map(opt => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            title={opt.desc}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
            style={{
              background:  active ? 'linear-gradient(135deg, #0D2B5E, #1565C0)' : 'transparent',
              color:       active ? '#fff' : '#64748b',
              boxShadow:   active ? '0 2px 8px rgba(13,43,94,.25)' : 'none',
            }}
          >
            {opt.emoji} {opt.label}
          </button>
        )
      })}
    </div>
  )
}
