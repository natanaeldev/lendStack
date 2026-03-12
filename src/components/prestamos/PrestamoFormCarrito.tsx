'use client'

import type { ReactNode } from 'react'
import { CURRENCIES, type CarritoFrequency, type Currency } from '@/lib/loan'

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
    <div className="space-y-4">
      <Section title="Condiciones del prestamo" subtitle="Configura el capital y la estructura general del carrito.">
        <Field label="Monto" hint="Capital principal a desembolsar.">
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
        <Field label="Tasa plana (%)" hint="Interes total plano aplicado al producto.">
          <input type="number" min="0" step="0.5" value={Number((flatRate * 100).toFixed(2))} onChange={(event) => onChange({ carritoFlatRate: Number(event.target.value) / 100 })} className={inputClassName} />
        </Field>
        <Field label="Frecuencia">
          <select value={frequency} onChange={(event) => onChange({ carritoFrequency: event.target.value })} className={inputClassName}>
            <option value="daily">Diaria</option>
            <option value="weekly">Semanal</option>
          </select>
        </Field>
      </Section>

      <Section title="Cobro" subtitle="Ajusta plazo y numero de cuotas segun la operacion real.">
        <Field label={`Plazo (${frequency === 'daily' ? 'dias' : 'semanas'})`} hint="Duracion total del producto.">
          <input type="number" min="1" step="1" value={term} onChange={(event) => onChange({ carritoTerm: Number(event.target.value) })} className={inputClassName} />
        </Field>
        <Field label="Cuotas" hint="Cantidad de pagos esperados durante el plazo.">
          <input type="number" min="1" step="1" value={payments} onChange={(event) => onChange({ carritoPayments: Number(event.target.value) })} className={inputClassName} />
        </Field>
        <Field label="Fecha de inicio">
          <input type="date" value={startDate} onChange={(event) => onChange({ startDate: event.target.value })} className={inputClassName} />
        </Field>
      </Section>

      <Section title="Notas operativas" subtitle="Incluye contexto de ruta, garantia o seguimiento solo si aporta.">
        <Field label="Observaciones" hint="Ej: frecuencia real de visita, referencia o garantia.">
          <textarea value={notes} onChange={(event) => onChange({ notes: event.target.value })} rows={4} placeholder="Notas sobre ruta, cobrador, garantia o seguimiento" className={`${inputClassName} min-h-[120px] resize-y`} />
        </Field>
      </Section>
    </div>
  )
}
