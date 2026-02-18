'use client'
import { RISK_PROFILES, RiskProfile } from '@/lib/loan'

interface Props { value: RiskProfile; onChange: (v: RiskProfile) => void }

export default function RiskSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {RISK_PROFILES.map((p) => {
        const active = value === p.label
        return (
          <button
            key={p.label}
            onClick={() => onChange(p.label)}
            className="relative rounded-xl p-4 text-left transition-all duration-200 focus:outline-none border-2"
            style={{
              background:   active ? p.colorBg  : '#fff',
              borderColor:  active ? p.colorAccent : '#e2e8f0',
              boxShadow:    active ? `0 4px 20px ${p.colorAccent}33` : '0 1px 4px rgba(0,0,0,.05)',
              transform:    active ? 'translateY(-1px)' : 'none',
            }}
          >
            {active && (
              <span className="absolute top-2.5 right-2.5 text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: p.colorAccent }}>
                ✓
              </span>
            )}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{p.emoji}</span>
              <span className="text-sm font-bold" style={{ color: active ? p.colorText : '#374151' }}>{p.label}</span>
            </div>
            <div className="text-xs font-bold mb-1" style={{ color: p.colorAccent }}>
              {(p.minRate * 100).toFixed(0)}%–{(p.maxRate * 100).toFixed(0)}%
              <span className="ml-1 font-normal text-slate-400">(mid {(p.midRate * 100).toFixed(0)}%)</span>
            </div>
            <p className="text-xs leading-snug text-slate-500">{p.description}</p>
          </button>
        )
      })}
    </div>
  )
}
