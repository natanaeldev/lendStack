'use client'

import type { ReactNode } from 'react'
import { CURRENCIES, type Currency } from '@/lib/loan'

const inputClassName =
  'mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{label}</label>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      {children}
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div>
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

export default function PrestamoFormSemanal({
  amount,
  currency,
  termWeeks,
  monthlyRate,
  startDate,
  notes,
  onChange,
}: {
  amount: number
  currency: Currency
  termWeeks: number
  monthlyRate: number
  startDate: string
  notes: string
  onChange: (patch: Record<string, string | number>) => void
}) {
  return (
    <div className="space-y-4">
      <Section title="Condiciones del prestamo" subtitle="Configura el capital y el ritmo de cobro semanal.">
        <Field label="Monto" hint="Capital principal a entregar.">
          <input type="number" min="0" step="100" value={amount} onChange={(event) => onChange({ amount: Number(event.target.value) })} className={inputClassName} />
        </Field>
        <Field label="Moneda">
          <select value={currency} onChange={(event) => onChange({ currency: event.target.value })} className={inputClassName}>
            {Object.values(CURRENCIES).map((option) => (
              <option key={option.code} value={option.code}>
                {option.flag} {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plazo (semanas)" hint="Cantidad total de cobros semanales.">
          <input type="number" min="1" step="1" value={termWeeks} onChange={(event) => onChange({ weeklyTermWeeks: Number(event.target.value) })} className={inputClassName} />
        </Field>
        <Field label="Frecuencia">
          <input value="Semanal" readOnly className={`${inputClassName} bg-slate-100`} />
        </Field>
      </Section>

      <Section title="InterÃ©s y arranque" subtitle="Ajusta la tasa mensual equivalente y deja la fecha lista.">
        <Field label="InterÃ©s mensual (%)" hint="Se usa para calcular la cuota semanal.">
          <input type="number" min="0" step="0.1" value={Number((monthlyRate * 100).toFixed(2))} onChange={(event) => onChange({ weeklyMonthlyRate: Number(event.target.value) / 100 })} className={inputClassName} />
        </Field>
        <Field label="Fecha de inicio">
          <input type="date" value={startDate} onChange={(event) => onChange({ startDate: event.target.value })} className={inputClassName} />
        </Field>
      </Section>

      <Section title="Notas operativas" subtitle="Agrega instrucciones para la ruta o el cobrador solo si son Ãºtiles.">
        <Field label="Observaciones" hint="Ej: cobrar en negocio o ruta preferida de visita.">
          <textarea value={notes} onChange={(event) => onChange({ notes: event.target.value })} rows={4} placeholder="Notas internas para ruta, cobranza o seguimiento" className={`${inputClassName} min-h-[120px] resize-y`} />
        </Field>
      </Section>
    </div>
  )
}
