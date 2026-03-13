'use client'

import type { ReactNode } from 'react'
import {
  CURRENCIES,
  RISK_PROFILES,
  type Currency,
  type RateMode,
  type RiskProfile,
} from '@/lib/loan'

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
    <div className="space-y-4">
      <Section title="Condiciones del prestamo" subtitle="Define el capital y la duracion del plan mensual.">
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
        <Field label="Plazo (meses)" hint="Cantidad total de cuotas mensuales.">
          <input type="number" min="1" step="1" value={termMonths} onChange={(event) => onChange({ monthlyTermMonths: Number(event.target.value) })} className={inputClassName} />
        </Field>
        <Field label="Frecuencia">
          <input value="Mensual" readOnly className={`${inputClassName} bg-slate-100`} />
        </Field>
      </Section>

      <Section title="Tasa y evaluacion" subtitle="Usa el perfil de riesgo o fija una tasa manual si aplica.">
        <Field label="Perfil de riesgo">
          <select value={profile} onChange={(event) => onChange({ monthlyProfile: event.target.value })} className={inputClassName}>
            {RISK_PROFILES.map((option) => (
              <option key={option.label} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Modo de tasa">
          <select value={rateMode} onChange={(event) => onChange({ monthlyRateMode: event.target.value })} className={inputClassName}>
            <option value="annual">Tasa por perfil</option>
            <option value="monthly">Tasa mensual manual</option>
          </select>
        </Field>
        {rateMode === 'monthly' && (
          <Field label="InterÃ©s mensual (%)" hint="Ingresa la tasa mensual exacta para este caso.">
            <input type="number" min="0" step="0.1" value={Number((customRate * 100).toFixed(2))} onChange={(event) => onChange({ monthlyCustomRate: Number(event.target.value) / 100 })} className={inputClassName} />
          </Field>
        )}
      </Section>

      <Section title="Inicio y notas" subtitle="Deja la fecha lista y agrega contexto operativo solo si hace falta.">
        <Field label="Fecha de inicio">
          <input type="date" value={startDate} onChange={(event) => onChange({ startDate: event.target.value })} className={inputClassName} />
        </Field>
        <Field label="Observaciones" hint="Notas para el equipo, la ruta o seguimiento.">
          <textarea value={notes} onChange={(event) => onChange({ notes: event.target.value })} rows={4} placeholder="Ej: cobrar despuÃ©s de las 4 p. m. o validar garante" className={`${inputClassName} min-h-[120px] resize-y`} />
        </Field>
      </Section>
    </div>
  )
}
