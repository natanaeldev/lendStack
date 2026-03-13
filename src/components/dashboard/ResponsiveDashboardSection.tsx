'use client'

import type { ReactNode } from 'react'

export default function ResponsiveDashboardSection({ eyebrow, title, description, action, children }: { eyebrow?: string; title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white px-4 py-5 shadow-[0_18px_36px_rgba(15,23,42,.06)] sm:px-5 sm:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p> : null}
          <h3 className="mt-1 break-words text-lg font-black text-slate-950 sm:text-xl">{title}</h3>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="sm:shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}
