'use client'

import type { ReactNode } from 'react'

export default function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h2>
        <p className="text-xs sm:text-sm text-slate-500">{description}</p>
      </div>
      {action ? <div className="sm:flex-shrink-0">{action}</div> : null}
    </div>
  )
}
