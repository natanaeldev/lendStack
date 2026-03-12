'use client'

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
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <div className="space-y-5">
          <section className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Paso 1</p>
              <h3 className="mt-1 text-lg font-bold text-slate-800">Elige el tipo de prestamo</h3>
              <p className="text-sm text-slate-500">Comienza por la estructura de cobro para no perder tiempo en calle.</p>
            </div>
            <LoanTypeSelector value={value.loanType} onChange={(loanType) => onChange({ loanType })} />
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Paso 2</p>
              <h3 className="mt-1 text-lg font-bold text-slate-800">Selecciona el cliente</h3>
              <p className="text-sm text-slate-500">Busca y elige un cliente existente sin salir de Prestamos.</p>
            </div>
            <ClienteSelectField clients={clients} selectedClientId={value.clientId} onChange={(clientId) => onChange({ clientId })} />
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Paso 3</p>
              <h3 className="mt-1 text-lg font-bold text-slate-800">{TYPE_TITLES[value.loanType]}</h3>
              <p className="text-sm text-slate-500">Completa solo los campos necesarios para este producto.</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5" style={{ boxShadow: '0 8px 24px rgba(15,23,42,.06)' }}>
              {value.loanType === 'amortized' && (
                <PrestamoFormMensual amount={value.amount} currency={value.currency} termMonths={value.monthlyTermMonths} profile={value.monthlyProfile} rateMode={value.monthlyRateMode} customRate={value.monthlyCustomRate} startDate={value.startDate} notes={value.notes} onChange={(patch) => onChange(patch as Partial<PrestamoFormState>)} />
              )}

              {value.loanType === 'weekly' && (
                <PrestamoFormSemanal amount={value.amount} currency={value.currency} termWeeks={value.weeklyTermWeeks} monthlyRate={value.weeklyMonthlyRate} startDate={value.startDate} notes={value.notes} onChange={(patch) => onChange(patch as Partial<PrestamoFormState>)} />
              )}

              {value.loanType === 'carrito' && (
                <PrestamoFormCarrito amount={value.amount} currency={value.currency} flatRate={value.carritoFlatRate} term={value.carritoTerm} payments={value.carritoPayments} frequency={value.carritoFrequency} startDate={value.startDate} notes={value.notes} onChange={(patch) => onChange(patch as Partial<PrestamoFormState>)} />
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-950 px-4 py-4 text-white sm:px-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Resumen rapido</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Cuota</p>
                <p className="mt-1 text-sm font-bold">{formatCurrency(preview.scheduledPayment, value.currency)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Frecuencia</p>
                <p className="mt-1 text-sm font-bold">{preview.frequencyLabel}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Cuotas</p>
                <p className="mt-1 text-sm font-bold">{preview.installments}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Interes</p>
                <p className="mt-1 text-sm font-bold">{preview.rateLabel}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Capital</p>
                <p className="mt-1 text-sm font-bold">{formatCurrency(value.amount, value.currency)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Total</p>
                <p className="mt-1 text-sm font-bold">{formatCurrency(preview.totalPayment, value.currency)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Interes total</p>
                <p className="mt-1 text-sm font-bold">{formatCurrency(preview.totalInterest, value.currency)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Inicio</p>
                <p className="mt-1 text-sm font-bold">{value.startDate || 'Pendiente'}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        {error && (
          <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
            Cancelar
          </button>
          <button type="button" onClick={onSubmit} disabled={isSubmitting} className="min-h-12 rounded-2xl px-4 text-sm font-bold text-white transition-opacity disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
            {isSubmitting ? 'Guardando...' : 'Guardar prestamo'}
          </button>
        </div>
      </div>
    </div>
  )
}

