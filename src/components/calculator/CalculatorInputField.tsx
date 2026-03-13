'use client'

import type { ReactNode } from 'react'

export default function CalculatorInputField({ label, helper, children }: { label: string; helper?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
      {helper ? <span className="mt-2 block text-xs leading-5 text-slate-500">{helper}</span> : null}
    </label>
  )
}
