'use client'

import type { ReactNode } from 'react'

export default function DashboardKpiCard({ label, value, subvalue, tone = 'neutral', icon }: { label: string; value: string; subvalue?: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand'; icon: ReactNode }) {
  const toneMap = {
    neutral: { border: '#E2E8F0', bg: '#FFFFFF', iconBg: '#F8FAFC', icon: '#334155', value: '#0F172A' },
    success: { border: '#BBF7D0', bg: '#F0FDF4', iconBg: '#DCFCE7', icon: '#166534', value: '#14532D' },
    warning: { border: '#FDE68A', bg: '#FFFBEB', iconBg: '#FEF3C7', icon: '#92400E', value: '#92400E' },
    danger: { border: '#FECACA', bg: '#FFF1F2', iconBg: '#FFE4E6', icon: '#BE123C', value: '#9F1239' },
    brand: { border: '#BFDBFE', bg: '#EFF6FF', iconBg: '#DBEAFE', icon: '#1D4ED8', value: '#0D2B5E' },
  } as const
  const palette = toneMap[tone]

  return (
    <article className="min-w-0 rounded-[24px] border px-4 py-4 sm:px-5 sm:py-5" style={{ background: palette.bg, borderColor: palette.border }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 break-words text-2xl font-black leading-none sm:text-[2rem]" style={{ color: palette.value }}>{value}</p>
          {subvalue ? <p className="mt-2 break-words text-sm leading-5 text-slate-500">{subvalue}</p> : null}
        </div>
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: palette.iconBg, color: palette.icon }}>
          <span className="h-5 w-5">{icon}</span>
        </span>
      </div>
    </article>
  )
}
