'use client'
import { useState, useCallback } from 'react'
import { RISK_PROFILES, RiskProfile, Currency, calculateLoan, formatCurrency, formatPercent, LoanSlot } from '@/lib/loan'

interface Props { currency: Currency }

const SLOT_COLORS = ['#1565C0', '#2e7d32', '#f59e0b', '#ef4444']

const DEFAULT_SLOTS: Omit<LoanSlot, 'result'>[] = [
  { id: '1', label: 'Préstamo A', color: SLOT_COLORS[0], params: { amount: 100000, termYears: 5,  profile: 'Medium Risk', currency: 'USD' } },
  { id: '2', label: 'Préstamo B', color: SLOT_COLORS[1], params: { amount: 200000, termYears: 10, profile: 'Low Risk',    currency: 'USD' } },
]

export default function MultiLoanPanel({ currency }: Props) {
  const [slots, setSlots] = useState<Omit<LoanSlot, 'result'>[]>(DEFAULT_SLOTS)
  const [compared, setCompared] = useState(false)

  const fmt = (v: number) => formatCurrency(v, currency)

  const updateSlot = (id: string, field: string, value: any) => {
    setSlots(prev => prev.map(s => s.id !== id ? s : { ...s, params: { ...s.params, [field]: value } }))
    setCompared(false)
  }

  const addSlot = () => {
    if (slots.length >= 4) return
    const id = String(Date.now())
    setSlots(prev => [...prev, {
      id, label: `Préstamo ${String.fromCharCode(64 + prev.length + 1)}`,
      color: SLOT_COLORS[prev.length],
      params: { amount: 150000, termYears: 7, profile: 'Medium Risk', currency }
    }])
    setCompared(false)
  }

  const removeSlot = (id: string) => {
    setSlots(prev => prev.filter(s => s.id !== id))
    setCompared(false)
  }

  const results = slots.map(s => ({ ...s, result: calculateLoan({ ...s.params, currency }) }))

  const metrics = [
    { label: 'Monto',               fn: (s: typeof results[0]) => fmt(s.params.amount) },
    { label: 'Plazo',               fn: (s: typeof results[0]) => `${s.params.termYears} años` },
    { label: 'Perfil de riesgo',    fn: (s: typeof results[0]) => `${RISK_PROFILES.find(r=>r.label===s.params.profile)?.emoji} ${s.params.profile}` },
    { label: 'Tasa anual',          fn: (s: typeof results[0]) => formatPercent(s.result.annualRate) },
    { label: 'Cuota mensual',       fn: (s: typeof results[0]) => fmt(s.result.monthlyPayment) },
    { label: 'Total a pagar',       fn: (s: typeof results[0]) => fmt(s.result.totalPayment) },
    { label: 'Total intereses',     fn: (s: typeof results[0]) => fmt(s.result.totalInterest) },
    { label: '% interés / capital', fn: (s: typeof results[0]) => formatPercent(s.result.interestRatio) },
  ]

  return (
    <div className="space-y-4">
      {/* Slot inputs */}
      <div className="space-y-3">
        {slots.map((slot, idx) => (
          <div key={slot.id} className="rounded-xl p-5 border-2 bg-white" style={{ borderColor: slot.color + '44' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full" style={{ background: slot.color + '18', color: slot.color }}>
                {slot.label}
              </span>
              {slots.length > 1 && (
                <button onClick={() => removeSlot(slot.id)} className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium">✕ Quitar</button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Monto ({currency})</label>
                <input type="number" value={slot.params.amount} min={1000} step={1000}
                  onChange={e => updateSlot(slot.id, 'amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-slate-200 text-sm font-bold focus:outline-none focus:border-blue-500 transition-colors"
                  style={{ color: '#0D2B5E' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Plazo (años)</label>
                <input type="number" value={slot.params.termYears} min={1} max={30}
                  onChange={e => updateSlot(slot.id, 'termYears', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-slate-200 text-sm font-bold focus:outline-none focus:border-blue-500 transition-colors"
                  style={{ color: '#0D2B5E' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Perfil de riesgo</label>
                <select value={slot.params.profile} onChange={e => updateSlot(slot.id, 'profile', e.target.value as RiskProfile)}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-slate-200 text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors bg-white"
                  style={{ color: '#0D2B5E' }}>
                  {RISK_PROFILES.map(p => <option key={p.label} value={p.label}>{p.emoji} {p.label} ({(p.midRate*100).toFixed(0)}%)</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {slots.length < 4 && (
          <button onClick={addSlot} className="px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
            + Agregar préstamo
          </button>
        )}
        <button onClick={() => setCompared(true)}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}>
          📊 Comparar préstamos
        </button>
      </div>

      {/* Results table */}
      {compared && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 slide-in">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50" style={{ width: '28%' }}>Métrica</th>
                {results.map(r => (
                  <th key={r.id} className="px-4 py-3 text-center" style={{ background: r.color + '15' }}>
                    <div className="text-xs font-bold" style={{ color: r.color }}>{r.label}</div>
                    <div className="text-xs text-slate-400 font-normal">{r.params.profile}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(({ label, fn }, i) => (
                <tr key={label} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f0f4fa' }}>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-600">{label}</td>
                  {results.map(r => (
                    <td key={r.id} className="px-4 py-3 text-center text-sm font-bold" style={{ color: r.color }}>
                      {fn(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
