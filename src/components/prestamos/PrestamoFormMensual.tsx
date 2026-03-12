'use client'

import {
  CURRENCIES,
  RISK_PROFILES,
  type Currency,
  type RateMode,
  type RiskProfile,
} from '@/lib/loan'

const inputClassName =
  'w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500'

export default function PrestamoFormMensual({
  amount,
  currency,
  termMonths,
  profile,
  rateMode,
  customRate,
  startDate,
  notes,
  onChange,
}: {
  amount: number
  currency: Currency
  termMonths: number
  profile: RiskProfile
  rateMode: RateMode
  customRate: number
  startDate: string
  notes: string
  onChange: (patch: Record<string, string | number>) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Monto</label>
        <input type="number" min="0" step="100" value={amount} onChange={(event) => onChange({ amount: Number(event.target.value) })} className={inputClassName} />
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Moneda</label>
        <select value={currency} onChange={(event) => onChange({ currency: event.target.value })} className={inputClassName}>
          {Object.values(CURRENCIES).map((option) => (
            <option key={option.code} value={option.code}>
              {option.flag} {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Plazo (meses)</label>
        <input type="number" min="1" step="1" value={termMonths} onChange={(event) => onChange({ monthlyTermMonths: Number(event.target.value) })} className={inputClassName} />
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Frecuencia</label>
        <input value="Mensual" readOnly className={`${inputClassName} bg-slate-50`} />
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Perfil de riesgo</label>
        <select value={profile} onChange={(event) => onChange({ monthlyProfile: event.target.value })} className={inputClassName}>
          {RISK_PROFILES.map((option) => (
            <option key={option.label} value={option.label}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Modo de tasa</label>
        <select value={rateMode} onChange={(event) => onChange({ monthlyRateMode: event.target.value })} className={inputClassName}>
          <option value="annual">Tasa por perfil</option>
          <option value="monthly">Tasa mensual manual</option>
        </select>
      </div>
      {rateMode === 'monthly' && (
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Interes mensual (%)</label>
          <input type="number" min="0" step="0.1" value={Number((customRate * 100).toFixed(2))} onChange={(event) => onChange({ monthlyCustomRate: Number(event.target.value) / 100 })} className={inputClassName} />
        </div>
      )}
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Fecha de inicio</label>
        <input type="date" value={startDate} onChange={(event) => onChange({ startDate: event.target.value })} className={inputClassName} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Observaciones</label>
        <textarea value={notes} onChange={(event) => onChange({ notes: event.target.value })} rows={3} placeholder="Notas internas para el equipo o el cobrador" className={`${inputClassName} min-h-[96px] resize-y`} />
      </div>
    </div>
  )
}

