'use client'

import type { ReactNode } from 'react'

export default function ResponsiveDetailSection({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="min-w-0 rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,.05)] sm:p-5">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>
          <h2 className="mt-1 text-balance break-words text-lg font-black text-slate-950">{title}</h2>
          {description ? <p className="mt-2 break-words text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="min-w-0 sm:shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  )
}
