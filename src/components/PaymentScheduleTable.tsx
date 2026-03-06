'use client'
import { useState } from 'react'
import { PaymentScheduleRow, Currency, formatCurrency } from '@/lib/loan'

interface Props {
  rows: PaymentScheduleRow[]
  accentColor: string
  currency: Currency
  periodLabel?: string   // 'Semana' | 'Día' | etc.
}

const PAGE = 14

export default function PaymentScheduleTable({ rows, accentColor, currency, periodLabel = 'Cuota' }: Props) {
  const [page, setPage] = useState(0)
  const total  = rows.length
  const pages  = Math.ceil(total / PAGE)
  const visible = rows.slice(page * PAGE, (page + 1) * PAGE)
  const fmt = (v: number) => formatCurrency(v, currency)

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}>
              {[periodLabel, 'Fecha', 'Cuota', 'Capital', 'Interés', 'Saldo', 'Int. acum.', 'Cap. acum.'].map((h, i) => (
                <th key={h} className="px-3 py-3 font-semibold tracking-wide whitespace-nowrap"
                  style={{ color: '#c5d5ea', textAlign: i === 0 ? 'center' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={row.period} style={{ background: i % 2 === 0 ? '#fff' : '#f0f4fa', borderBottom: '1px solid #e8eef7' }}>
                <td className="px-3 py-2.5 text-center font-bold" style={{ color: '#0D2B5E' }}>{row.period}</td>
                <td className="px-3 py-2.5 text-right text-slate-500 whitespace-nowrap">{formatDate(row.dueDate)}</td>
                <td className="px-3 py-2.5 text-right font-semibold" style={{ color: '#0D2B5E' }}>{fmt(row.payment)}</td>
                <td className="px-3 py-2.5 text-right font-medium" style={{ color: '#1565C0' }}>{fmt(row.principal)}</td>
                <td className="px-3 py-2.5 text-right font-medium" style={{ color: accentColor }}>{fmt(row.interest)}</td>
                <td className="px-3 py-2.5 text-right">{fmt(row.balance)}</td>
                <td className="px-3 py-2.5 text-right text-slate-500">{fmt(row.cumInterest)}</td>
                <td className="px-3 py-2.5 text-right text-slate-500">{fmt(row.cumPrincipal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
          <span>{periodLabel} {page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} de {total}</span>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 rounded-lg font-medium disabled:opacity-30 transition-colors"
              style={{ background: '#e8eef7', color: '#0D2B5E' }}>←</button>
            {Array.from({ length: Math.min(pages, 8) }, (_, i) => {
              // show pages near current page when many pages
              const totalPageNums = Math.min(pages, 8)
              const startPage = Math.max(0, Math.min(page - Math.floor(totalPageNums / 2), pages - totalPageNums))
              const pageIdx = startPage + i
              return (
                <button key={pageIdx} onClick={() => setPage(pageIdx)}
                  className="px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{ background: page === pageIdx ? '#1565C0' : '#e8eef7', color: page === pageIdx ? '#fff' : '#0D2B5E' }}>
                  {pageIdx + 1}
                </button>
              )
            })}
            <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1}
              className="px-3 py-1.5 rounded-lg font-medium disabled:opacity-30 transition-colors"
              style={{ background: '#e8eef7', color: '#0D2B5E' }}>→</button>
          </div>
        </div>
      )}
    </div>
  )
}
