'use client'

const TONE_CLASSES = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
  inverse: 'border-white/15 bg-white/10 text-white',
} as const

export default function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: keyof typeof TONE_CLASSES
}) {
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.04em] ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  )
}
