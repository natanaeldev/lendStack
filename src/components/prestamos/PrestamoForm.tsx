'use client'

import type { ReactNode } from 'react'
import { formatCurrency, type LoanType } from '@/lib/loan'
import ClienteSelectField from './ClienteSelectField'
import LoanTypeSelector from './LoanTypeSelector'
import PrestamoFormCarrito from './PrestamoFormCarrito'
import PrestamoFormMensual from './PrestamoFormMensual'
import PrestamoFormSemanal from './PrestamoFormSemanal'
import type { PrestamoClientOption, PrestamoFormState, PrestamoPreview } from './types'

const TYPE_TITLES: Record<LoanType, string> = {
  amortized: 'Prestamo mensual',
  weekly: 'Prestamo semanal',
  carrito: 'Prestamo carrito',
}

function StepCard({
  step,
  title,
  description,
  complete,
  children,
}: {
  step: string
  title: string
  description: string
  complete?: boolean
  children: ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,.05)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{step}</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {complete ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
            Completo
          </span>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function PrestamoForm({
  clients,
  value,
  preview,
  error,
  isSubmitting,
  onChange,
  onSubmit,
  onCancel,
}: {
  clients: PrestamoClientOption[]
  value: PrestamoFormState
  preview: PrestamoPreview
  error: string
  isSubmitting: boolean
  onChange: (patch: Partial<PrestamoFormState>) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const selectedClient = clients.find((client) => client.id === value.clientId) ?? null

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <div className="mb-4 rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_36px_rgba(15,23,42,.05)] sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">3 pasos</span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">{TYPE_TITLES[value.loanType]}</span>
            {selectedClient ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Cliente listo</span>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Cliente pendiente</span>
            )}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Completa el producto, el cliente y las condiciones sin salir de Prestamos.
          </p>
        </div>

        <div className="space-y-5 pb-6">
          <StepCard
            step="Paso 1"
            title="Elige el tipo de prestamo"
            description="Empieza por la estructura de cobro correcta para no rehacer el formulario despues."
            complete
          >
            <LoanTypeSelector value={value.loanType} onChange={(loanType) => onChange({ loanType })} />
          </StepCard>

          <StepCard
            step="Paso 2"
            title="Selecciona el cliente"
            description="Busca y elige un cliente existente sin cambiar de seccion."
            complete={Boolean(selectedClient)}
          >
            <ClienteSelectField clients={clients} selectedClientId={value.clientId} onChange={(clientId) => onChange({ clientId })} />
          </StepCard>

          <StepCard
            step="Paso 3"
            title={TYPE_TITLES[value.loanType]}
            description="Completa solo los campos que importan para este producto."
          >
            {value.loanType === 'amortized' && (
              <PrestamoFormMensual amount={value.amount} currency={value.currency} termMonths={value.monthlyTermMonths} profile={value.monthlyProfile} rateMode={value.monthlyRateMode} customRate={value.monthlyCustomRate} startDate={value.startDate} notes={value.notes} onChange={(patch) => onChange(patch as Partial<PrestamoFormState>)} />
            )}

            {value.loanType === 'weekly' && (
              <PrestamoFormSemanal amount={value.amount} currency={value.currency} termWeeks={value.weeklyTermWeeks} monthlyRate={value.weeklyMonthlyRate} startDate={value.startDate} notes={value.notes} onChange={(patch) => onChange(patch as Partial<PrestamoFormState>)} />
            )}

            {value.loanType === 'carrito' && (
              <PrestamoFormCarrito amount={value.amount} currency={value.currency} flatRate={value.carritoFlatRate} term={value.carritoTerm} payments={value.carritoPayments} frequency={value.carritoFrequency} startDate={value.startDate} notes={value.notes} onChange={(patch) => onChange(patch as Partial<PrestamoFormState>)} />
            )}
          </StepCard>

          <section className="rounded-[28px] border border-slate-200 bg-slate-950 px-4 py-5 text-white shadow-[0_16px_42px_rgba(2,6,23,.35)] sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Resumen rapido</p>
                <h3 className="mt-1 text-lg font-bold text-white">Verifica antes de guardar</h3>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Cuota estimada</p>
                <p className="mt-1 text-xl font-bold text-white">{formatCurrency(preview.scheduledPayment, value.currency)}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Frecuencia</p>
                <p className="mt-1 text-sm font-bold">{preview.frequencyLabel}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Cuotas</p>
                <p className="mt-1 text-sm font-bold">{preview.installments}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Capital</p>
                <p className="mt-1 text-sm font-bold">{formatCurrency(value.amount, value.currency)}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Tasa</p>
                <p className="mt-1 text-sm font-bold">{preview.rateLabel}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Total</p>
                <p className="mt-1 text-sm font-bold">{formatCurrency(preview.totalPayment, value.currency)}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Interes total</p>
                <p className="mt-1 text-sm font-bold">{formatCurrency(preview.totalInterest, value.currency)}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Inicio</p>
                <p className="mt-1 text-sm font-bold">{value.startDate || 'Pendiente'}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Cliente</p>
                <p className="mt-1 text-sm font-bold">{selectedClient?.name ?? 'Pendiente'}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Listo para guardar</p>
            <p className="truncate text-sm font-semibold text-slate-800">
              {selectedClient ? selectedClient.name : 'Selecciona un cliente para continuar'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Cuota</p>
            <p className="text-sm font-bold text-slate-900">{formatCurrency(preview.scheduledPayment, value.currency)}</p>
          </div>
        </div>
        {error && (
          <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onSubmit} disabled={isSubmitting} className="min-h-12 rounded-2xl px-4 text-sm font-bold text-white transition-opacity disabled:opacity-50 sm:order-2" style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
            {isSubmitting ? 'Guardando...' : 'Guardar prestamo'}
          </button>
          <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:order-1">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
