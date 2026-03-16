'use client'

import { EmptyDashboardIcon } from './DashboardIcons'

export default function DashboardEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-5 py-10 text-center shadow-[0_18px_36px_rgba(15,23,42,.04)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-slate-100 text-slate-600">
        <EmptyDashboardIcon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}
