'use client'

import type { ReactNode } from 'react'

export interface QuickActionItem {
  label: string
  description: string
  icon: ReactNode
  tone: 'brand' | 'neutral' | 'danger'
  onClick: () => void
}

export default function QuickActionsPanel({ actions }: { actions: QuickActionItem[] }) {
  const tones = {
    brand: { bg: 'linear-gradient(135deg,#0D2B5E,#1565C0)', text: '#FFFFFF', border: '#0D2B5E' },
    neutral: { bg: '#FFFFFF', text: '#0F172A', border: '#E2E8F0' },
    danger: { bg: '#FFF1F2', text: '#9F1239', border: '#FECACA' },
  } as const

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {actions.map((action) => {
        const tone = tones[action.tone]
        return (
          <button key={action.label} type="button" onClick={action.onClick} className="flex min-h-[88px] w-full items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition-transform hover:-translate-y-0.5 active:scale-[0.99]" style={{ background: tone.bg, color: tone.text, borderColor: tone.border, boxShadow: action.tone === 'brand' ? '0 14px 30px rgba(21,101,192,.25)' : 'none' }}>
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <span className="h-5 w-5">{action.icon}</span>
            </span>
            <span className="min-w-0">
              <span className="block break-words text-sm font-black">{action.label}</span>
              <span className={`mt-1 block break-words text-xs leading-5 ${action.tone === 'brand' ? 'text-white/80' : 'text-slate-500'}`}>{action.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
