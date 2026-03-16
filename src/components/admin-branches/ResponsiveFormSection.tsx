'use client'

import type { ReactNode } from 'react'

export default function ResponsiveFormSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,.05)] sm:p-5">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>
        <h3 className="mt-1 text-balance break-words text-lg font-black text-slate-950">{title}</h3>
        {description ? <p className="mt-2 break-words text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  )
}
