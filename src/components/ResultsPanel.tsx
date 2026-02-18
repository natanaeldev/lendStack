'use client'
import { LoanResult, RiskConfig, Currency, formatCurrency, formatPercent } from '@/lib/loan'

interface Props { result: LoanResult; config: RiskConfig; currency: Currency }

function StatCard({ label, value, sub, accentColor }: { label: string; value: string; sub?: string; accentColor?: string }) {
  return (
    <div className="rounded-xl p-4 border border-slate-200 bg-white" style={{ boxShadow: '0 1px 6px rgba(0,0,0,.05)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{label}</p>
      <p className="font-display text-2xl leading-none" style={{ color: accentColor || '#0D2B5E' }}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
    </div>
  )
}

export default function ResultsPanel({ result, config, currency }: Props) {
  const fmt = (v: number) => formatCurrency(v, currency)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 px-5 py-4 rounded-xl border" style={{ background: config.colorBg, borderColor: config.colorAccent + '44' }}>
        <span className="text-3xl">{config.emoji}</span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: config.colorAccent }}>{config.label} — Tasa anual aplicada</p>
          <p className="font-display text-3xl" style={{ color: config.colorText }}>{formatPercent(result.annualRate)}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs mb-0.5" style={{ color: config.colorText }}>Tasa mensual</p>
          <p className="text-xl font-bold" style={{ color: config.colorText }}>{formatPercent(result.monthlyRate, 3)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Cuota mensual" value={fmt(result.monthlyPayment)} sub={`× ${result.totalMonths} meses`} accentColor="#0D2B5E" />
        <StatCard label="Total a pagar" value={fmt(result.totalPayment)} sub="Capital + intereses" />
        <StatCard label="Total intereses" value={fmt(result.totalInterest)} sub={`${formatPercent(result.interestRatio)} del capital`} accentColor={config.colorAccent} />
        <StatCard label="Plazo total" value={`${result.totalMonths}`} sub="meses" />
      </div>
    </div>
  )
}
