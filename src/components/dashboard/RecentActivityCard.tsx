'use client'

import { formatShortDate } from './helpers'
import { PaymentIcon, UserPlusIcon } from './DashboardIcons'
import type { RecentActivityItem } from './types'

export default function RecentActivityCard({ items, onOpenClient }: { items: RecentActivityItem[]; onOpenClient?: (clientId: string) => void }) {
  if (items.length === 0) {
    return <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No hay actividad reciente todavía.</div>
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => item.clientId ? onOpenClient?.(item.clientId) : undefined} className="flex w-full flex-col gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-blue-200 hover:bg-blue-50 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl ${item.type === 'payment' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                {item.type === 'payment' ? <PaymentIcon className="h-4 w-4" /> : <UserPlusIcon className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                <p className="break-words text-sm font-black text-slate-950">{item.title}</p>
                <p className="break-words text-xs text-slate-500">{item.subtitle}</p>
              </div>
            </div>
            <p className="mt-2 break-words text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{item.meta}</p>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end">
            {item.amountLabel ? <span className="break-words text-right text-sm font-black text-slate-950">{item.amountLabel}</span> : null}
            <span className="shrink-0 text-xs font-semibold text-slate-400">{formatShortDate(item.date)}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
