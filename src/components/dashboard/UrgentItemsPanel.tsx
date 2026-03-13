'use client'

import { formatCurrency } from '@/lib/loan'
import type { Currency } from '@/lib/loan'
import { formatShortDate } from './helpers'
import type { UrgentItem } from './types'

function fmt(amount: number, currency: Currency) {
  return formatCurrency(amount, currency)
}

export default function UrgentItemsPanel({ items, onOpenClient }: { items: UrgentItem[]; onOpenClient: (clientId: string) => void }) {
  const toneMap = {
    overdue: { label: 'Moroso', bg: '#FFF1F2', color: '#9F1239', border: '#FECACA' },
    due_today: { label: 'Hoy', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
    upcoming: { label: 'Próximo', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  } as const

  if (items.length === 0) {
    return <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No hay alertas urgentes en este momento.</div>
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 6).map((item) => {
        const tone = toneMap[item.status]
        return (
          <button key={`${item.clientId}-${item.dueDate}`} type="button" onClick={() => onOpenClient(item.clientId)} className="flex w-full flex-col gap-3 rounded-[24px] border px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,.08)] sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: tone.border, background: '#FFFFFF' }}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words text-sm font-black text-slate-950">{item.clientName}</p>
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ background: tone.bg, color: tone.color, borderColor: tone.border }}>{tone.label}</span>
              </div>
              <p className="mt-2 break-words text-sm text-slate-500">{item.phone || 'Sin teléfono'} · {formatShortDate(item.dueDate)}</p>
              <p className="mt-1 break-words text-xs font-semibold text-slate-400">{item.status === 'overdue' ? `${Math.abs(item.daysFromToday)} días de atraso` : item.status === 'due_today' ? 'Cobro esperado hoy' : `Vence en ${item.daysFromToday} días`}</p>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end">
              <p className="break-words text-base font-black text-slate-950">{fmt(item.amount, item.currency)}</p>
              <span className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">Abrir</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
