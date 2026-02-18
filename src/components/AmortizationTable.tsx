'use client'
import { useState } from 'react'
import { AmortizationRow, Currency, formatCurrency } from '@/lib/loan'

interface Props { rows: AmortizationRow[]; accentColor: string; currency: Currency }

export default function AmortizationTable({ rows, accentColor, currency }: Props) {
  const [page, setPage] = useState(0)
  const PAGE = 12
  const total = rows.length
  const pages = Math.ceil(total / PAGE)
  const visible = rows.slice(page * PAGE, (page + 1) * PAGE)
  const fmt = (v: number) => formatCurrency(v, currency)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}>
              {['#', 'Saldo inicial', 'Cuota', 'Capital', 'Interés', 'Saldo final', 'Int. acum.', 'Cap. acum.'].map((h, i) => (
                <th key={h} className="px-3 py-3 font-semibold tracking-wide whitespace-nowrap"
                  style={{ color: '#c5d5ea', textAlign: i === 0 ? 'center' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={row.month} style={{ background: i % 2 === 0 ? '#fff' : '#f0f4fa', borderBottom: '1px solid #e8eef7' }}>
                <td className="px-3 py-2.5 text-center font-bold" style={{ color: '#0D2B5E' }}>{row.month}</td>
                <td className="px-3 py-2.5 text-right">{fmt(row.openingBalance)}</td>
                <td className="px-3 py-2.5 text-right font-semibold" style={{ color: '#0D2B5E' }}>{fmt(row.payment)}</td>
                <td className="px-3 py-2.5 text-right font-medium" style={{ color: '#1565C0' }}>{fmt(row.principal)}</td>
                <td className="px-3 py-2.5 text-right font-medium" style={{ color: accentColor }}>{fmt(row.interest)}</td>
                <td className="px-3 py-2.5 text-right">{fmt(row.closingBalance)}</td>
                <td className="px-3 py-2.5 text-right text-slate-500">{fmt(row.cumInterest)}</td>
                <td className="px-3 py-2.5 text-right text-slate-500">{fmt(row.cumPrincipal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
          <span>Meses {page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} de {total}</span>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 rounded-lg font-medium disabled:opacity-30 transition-colors"
              style={{ background: '#e8eef7', color: '#0D2B5E' }}>←</button>
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className="px-3 py-1.5 rounded-lg font-medium transition-colors"
                style={{ background: page === i ? '#1565C0' : '#e8eef7', color: page === i ? '#fff' : '#0D2B5E' }}>
                {i + 1}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1}
              className="px-3 py-1.5 rounded-lg font-medium disabled:opacity-30 transition-colors"
              style={{ background: '#e8eef7', color: '#0D2B5E' }}>→</button>
          </div>
        </div>
      )}
    </div>
  )
}
