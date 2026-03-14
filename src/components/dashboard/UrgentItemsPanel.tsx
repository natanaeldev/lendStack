'use client'

import { formatCurrency } from '@/lib/loan'
import type { Currency } from '@/lib/loan'
import { formatShortDate } from './helpers'
import type { UrgentItem } from './types'

function fmt(amount: number, currency: Currency) {
  return formatCurrency(amount, currency)
}

function urgencyCopy(item: UrgentItem) {
  if (item.status === 'overdue') return `${Math.abs(item.daysFromToday)} días de atraso`
  if (item.status === 'due_today') return 'Vence hoy'
  return `Vence en ${item.daysFromToday} días`
}

export default function UrgentItemsPanel({
  items,
  onOpenClient,
  onQuickPay,
}: {
  items: UrgentItem[]
  onOpenClient: (clientId: string) => void
  onQuickPay: (clientId: string) => void
}) {
  const toneMap = {
    overdue: { label: 'Moroso', bg: '#FFF1F2', color: '#9F1239', border: '#FECACA', accent: '#BE123C' },
    due_today: { label: 'Vence hoy', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', accent: '#B45309' },
    upcoming: { label: 'Próximo', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', accent: '#2563EB' },
  } as const

  if (items.length === 0) {
    return <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No hay alertas urgentes en este momento.</div>
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 6).map((item) => {
        const tone = toneMap[item.status]

        return (
          <article
            key={`${item.clientId}-${item.dueDate}`}
            className="rounded-[24px] border bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,.08)]"
            style={{ borderColor: tone.border }}
          >
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 break-words text-sm font-black text-slate-950 sm:text-base">{item.clientName || '—'}</p>
                  <span
                    className="rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
                    style={{ background: tone.bg, color: tone.color, borderColor: tone.border }}
                  >
                    {tone.label}
                  </span>
                </div>

                <p className="mt-2 break-words text-sm text-slate-500">
                  {item.branchName || 'No disponible'} · {item.phone || 'No disponible'}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Monto pendiente</p>
                    <p className="mt-1 break-words text-sm font-black text-slate-950">{fmt(item.amount, item.currency)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Fecha límite</p>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-900">{formatShortDate(item.dueDate)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Seguimiento</p>
                    <p className="mt-1 break-words text-sm font-semibold" style={{ color: tone.accent }}>
                      {urgencyCopy(item)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 lg:w-[220px]">
                <button
                  type="button"
                  onClick={() => onQuickPay(item.clientId)}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0D2B5E,#1565C0)] px-4 text-sm font-bold text-white shadow-[0_16px_28px_rgba(21,101,192,.24)] transition hover:opacity-95"
                >
                  Pago rápido
                </button>
                <button
                  type="button"
                  onClick={() => onOpenClient(item.clientId)}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Ver detalle
                </button>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
