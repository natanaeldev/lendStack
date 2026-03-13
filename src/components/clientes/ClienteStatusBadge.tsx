'use client'

import { BADGE_TONES } from './helpers'

export default function ClienteStatusBadge({
  label,
  tone,
}: {
  label: string
  tone: keyof typeof BADGE_TONES
}) {
  const styles = BADGE_TONES[tone]

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.02em]"
      style={{
        background: styles.background,
        borderColor: styles.border,
        color: styles.color,
      }}
    >
      {label}
    </span>
  )
}
