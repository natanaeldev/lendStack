'use client'

import type { ReactNode } from 'react'
import DashboardKpiCard from './DashboardKpiCard'

export interface DashboardKpiItem {
  label: string
  value: string
  subvalue?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand'
  icon: ReactNode
}

export default function DashboardKpiGrid({ items }: { items: DashboardKpiItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <DashboardKpiCard key={item.label} {...item} />
      ))}
    </div>
  )
}
