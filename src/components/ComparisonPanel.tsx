'use client'
import { RISK_PROFILES, calculateLoan, formatCurrency, formatPercent, Currency, LoanParams } from '@/lib/loan'

interface Props { amount: number; termYears: number; currency: Currency }

export default function ComparisonPanel({ amount, termYears, currency }: Props) {
  const fmt = (v: number) => formatCurrency(v, currency)
  const results = RISK_PROFILES.map((p) => ({
    config: p,
    result: calculateLoan({ amount, termYears, profile: p.label, currency }),
  }))
  const metrics = [
    { label: 'Tasa anual',          fn: (r: ReturnType<typeof calculateLoan>) => formatPercent(r.annualRate) },
    { label: 'Tasa mensual',        fn: (r: ReturnType<typeof calculateLoan>) => formatPercent(r.monthlyRate, 3) },
    { label: 'Cuota mensual',       fn: (r: ReturnType<typeof calculateLoan>) => fmt(r.monthlyPayment) },
    { label: 'Total a pagar',       fn: (r: ReturnType<typeof calculateLoan>) => fmt(r.totalPayment) },
    { label: 'Total intereses',     fn: (r: ReturnType<typeof calculateLoan>) => fmt(r.totalInterest) },
    { label: '% interés / capital', fn: (r: ReturnType<typeof calculateLoan>) => formatPercent(r.interestRatio) },
  ]
  const baseInterest = results[0].result.totalInterest

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500" style={{ width: '35%' }}>Métrica</th>
              {results.map(({ config }) => (
                <th key={config.label} className="px-4 py-3 text-center">
                  <div className="text-lg">{config.emoji}</div>
                  <div className="text-xs font-bold" style={{ color: config.colorText }}>{config.label}</div>
                  <div className="text-xs font-normal" style={{ color: config.colorAccent }}>{(config.minRate * 100).toFixed(0)}–{(config.maxRate * 100).toFixed(0)}%</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(({ label, fn }, i) => (
              <tr key={label} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f0f4fa' }}>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{label}</td>
                {results.map(({ config, result }) => (
                  <td key={config.label} className="px-4 py-3 text-center text-sm font-bold"
                    style={{ color: config.colorAccent, background: i % 2 === 0 ? config.colorBg + '60' : config.colorBg + 'a0' }}>
                    {fn(result)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f0f4fa', borderTop: '2px solid #e2e8f0' }}>
              <td className="px-4 py-3 text-xs font-bold" style={{ color: '#0D2B5E' }}>Costo extra vs Riesgo Bajo</td>
              {results.map(({ config }, i) => {
                const diff = results[i].result.totalInterest - baseInterest
                return (
                  <td key={config.label} className="px-4 py-3 text-center text-sm font-bold"
                    style={{ color: diff === 0 ? '#2E7D32' : '#C0392B' }}>
                    {i === 0 ? '—' : `+${fmt(diff)}`}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      {/* Risk mini cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {RISK_PROFILES.map((p) => (
          <div key={p.label} className="rounded-xl p-4" style={{ background: p.colorBg, border: `1px solid ${p.colorAccent}33` }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{p.emoji}</span>
              <span className="text-sm font-bold" style={{ color: p.colorText }}>{p.label}</span>
            </div>
            <div className="flex justify-between text-xs mb-1" style={{ color: p.colorAccent }}><span>Mín</span><span>Mid ★</span><span>Máx</span></div>
            <div className="flex justify-between text-sm font-bold" style={{ color: p.colorText }}>
              <span>{(p.minRate*100).toFixed(0)}%</span><span>{(p.midRate*100).toFixed(0)}%</span><span>{(p.maxRate*100).toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200">
              <div className="h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${p.colorAccent}55, ${p.colorAccent})`, width: `${(p.midRate / 0.15) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
