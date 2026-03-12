'use client'

import { CURRENCIES, type CarritoFrequency, type Currency } from '@/lib/loan'

const inputClassName =
  'w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500'

export default function PrestamoFormCarrito({
  amount,
  currency,
  flatRate,
  term,
  payments,
  frequency,
  startDate,
  notes,
  onChange,
}: {
  amount: number
  currency: Currency
  flatRate: number
  term: number
  payments: number
  frequency: CarritoFrequency
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
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Tasa plana (%)</label>
        <input type="number" min="0" step="0.5" value={Number((flatRate * 100).toFixed(2))} onChange={(event) => onChange({ carritoFlatRate: Number(event.target.value) / 100 })} className={inputClassName} />
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Frecuencia</label>
        <select value={frequency} onChange={(event) => onChange({ carritoFrequency: event.target.value })} className={inputClassName}>
          <option value="daily">Diaria</option>
          <option value="weekly">Semanal</option>
        </select>
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Plazo ({frequency === 'daily' ? 'dias' : 'semanas'})
        </label>
        <input type="number" min="1" step="1" value={term} onChange={(event) => onChange({ carritoTerm: Number(event.target.value) })} className={inputClassName} />
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Cuotas</label>
        <input type="number" min="1" step="1" value={payments} onChange={(event) => onChange({ carritoPayments: Number(event.target.value) })} className={inputClassName} />
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Fecha de inicio</label>
        <input type="date" value={startDate} onChange={(event) => onChange({ startDate: event.target.value })} className={inputClassName} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Observaciones</label>
        <textarea value={notes} onChange={(event) => onChange({ notes: event.target.value })} rows={3} placeholder="Notas sobre ruta, cobrador, garantia o seguimiento" className={`${inputClassName} min-h-[96px] resize-y`} />
      </div>
    </div>
  )
}

