'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatCurrency, type LoanType } from '@/lib/loan'
import ClienteSelectField from './ClienteSelectField'
import LoanTypeSelector from './LoanTypeSelector'
import PrestamoFormCarrito from './PrestamoFormCarrito'
import PrestamoFormMensual from './PrestamoFormMensual'
import PrestamoFormSemanal from './PrestamoFormSemanal'
import type { PrestamoClientOption, PrestamoFormState, PrestamoPreview } from './types'

const TYPE_TITLES: Record<LoanType, string> = {
  amortized: 'Préstamo mensual',
  weekly: 'Préstamo semanal',
  carrito: 'Préstamo carrito',
}

type StepKey = 'product' | 'client' | 'terms'

function StepSummary({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-slate-100 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function StepPanel({
  step,
  title,
  description,
  active,
  complete,
  summary,
  onOpen,
  action,
  children,
}: {
  step: string
  title: string
  description: string
  active: boolean
  complete?: boolean
  summary?: string
  onOpen?: () => void
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      className="rounded-[28px] border bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,.05)] transition-all sm:p-5"
      style={{
        borderColor: active ? '#BFDBFE' : '#E2E8F0',
        boxShadow: active ? '0 0 0 3px rgba(21,101,192,.10), 0 18px 38px rgba(15,23,42,.08)' : '0 12px 36px rgba(15,23,42,.05)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{step}</p>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{
                color: complete ? '#047857' : active ? '#1565C0' : '#64748B',
                background: complete ? '#ECFDF5' : active ? '#EFF6FF' : '#F8FAFC',
              }}
            >
              {complete ? 'Listo' : active ? 'En curso' : 'Pendiente'}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          {!active && summary ? <p className="mt-2 text-sm font-semibold text-slate-700">{summary}</p> : null}
        </div>
        {!active && onOpen ? (
          <button type="button" onClick={onOpen} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
            Editar
          </button>
        ) : null}
      </div>

      {active ? <div className="mt-4">{children}</div> : null}
      {active && action ? <div className="mt-4">{action}</div> : null}
    </section>
  )
}

function getTermsSummary(value: PrestamoFormState) {
  if (value.loanType === 'amortized') {
    return `${value.monthlyTermMonths} meses · ${formatCurrency(value.amount, value.currency)}`
  }

  if (value.loanType === 'weekly') {
    return `${value.weeklyTermWeeks} semanas · ${formatCurrency(value.amount, value.currency)}`
  }

  return `${value.carritoPayments} cuotas · ${formatCurrency(value.amount, value.currency)}`
}

function getReadiness(value: PrestamoFormState, selectedClientName: string | null) {
  const items: string[] = []

  if (!selectedClientName) items.push('Selecciona un cliente')
  if (!value.startDate) items.push('Define la fecha de inicio')
  if (!value.amount || value.amount <= 0) items.push('Ingresa un monto válido')

  if (value.loanType === 'amortized' && value.monthlyTermMonths < 1) items.push('Revisa el plazo mensual')
  if (value.loanType === 'weekly' && value.weeklyTermWeeks < 1) items.push('Revisa el plazo semanal')
  if (value.loanType === 'carrito' && value.carritoPayments < 1) items.push('Revisa las cuotas del carrito')

  return items
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
  const [activeStep, setActiveStep] = useState<StepKey>('product')

  useEffect(() => {
    if (!value.clientId && activeStep === 'terms') {
      setActiveStep('client')
      return
    }

    if (value.clientId && activeStep === 'client') {
      setActiveStep('terms')
    }
  }, [activeStep, value.clientId])

  const readinessItems = useMemo(() => getReadiness(value, selectedClient?.name ?? null), [selectedClient?.name, value])
  const canSave = readinessItems.length === 0 && !isSubmitting

  const topSummary = [
    { label: 'Producto', value: TYPE_TITLES[value.loanType] },
    { label: 'Cliente', value: selectedClient?.name ?? 'Pendiente' },
    { label: 'Cuota', value: formatCurrency(preview.scheduledPayment, value.currency) },
  ]

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <div className="mb-4 rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_36px_rgba(15,23,42,.05)] sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Flujo guiado</span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Cálculo en tiempo real</span>
            {canSave ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Listo para guardar</span>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Faltan datos clave</span>
            )}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            El flujo muestra una sola decisión importante a la vez para terminar el préstamo más rápido y con menos errores.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {topSummary.map((item) => (
              <StepSummary key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </div>

        <div className="space-y-5 pb-6">
          <StepPanel
            step="Paso 1"
            title="Elige el tipo de préstamo"
            description="Empieza por la estructura correcta para que el resto del formulario se adapte solo."
            active={activeStep === 'product'}
            complete
            summary={TYPE_TITLES[value.loanType]}
            onOpen={() => setActiveStep('product')}
            action={
              <div className="flex justify-end">
                <button type="button" onClick={() => setActiveStep('client')} className="min-h-11 rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white">
                  Continuar con cliente
                </button>
              </div>
            }
          >
            <LoanTypeSelector value={value.loanType} onChange={(loanType) => onChange({ loanType })} />
          </StepPanel>

          <StepPanel
            step="Paso 2"
            title="Selecciona el cliente"
            description="Busca y confirma a la persona correcta antes de capturar condiciones."
            active={activeStep === 'client'}
            complete={Boolean(selectedClient)}
            summary={selectedClient ? `${selectedClient.name}${selectedClient.branchName ? ` · ${selectedClient.branchName}` : ''}` : 'Pendiente'}
            onOpen={() => setActiveStep('client')}
            action={
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setActiveStep('product')} className="min-h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">
                  Volver
                </button>
                <button type="button" onClick={() => setActiveStep('terms')} disabled={!selectedClient} className="min-h-11 rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-40">
                  Continuar con condiciones
                </button>
              </div>
            }
          >
            <ClienteSelectField clients={clients} selectedClientId={value.clientId} onChange={(clientId) => onChange({ clientId })} />
          </StepPanel>

          <StepPanel
            step="Paso 3"
            title={TYPE_TITLES[value.loanType]}
            description="Completa solo los datos que cambian este préstamo y confirma el cálculo antes de guardarlo."
            active={activeStep === 'terms'}
            complete={canSave}
            summary={getTermsSummary(value)}
            onOpen={() => setActiveStep('terms')}
          >
            <div className="mb-4 rounded-[24px] border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Resumen operativo</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {selectedClient ? `${selectedClient.name} iniciará el ${value.startDate || 'día pendiente'} con una cuota estimada de ${formatCurrency(preview.scheduledPayment, value.currency)} ${preview.frequencyLabel.toLowerCase()}.` : 'Selecciona un cliente para completar el contexto del préstamo.'}
              </p>
            </div>

            {value.loanType === 'amortized' && (
              <PrestamoFormMensual amount={value.amount} currency={value.currency} termMonths={value.monthlyTermMonths} profile={value.monthlyProfile} rateMode={value.monthlyRateMode} customRate={value.monthlyCustomRate} startDate={value.startDate} notes={value.notes} onChange={(patch) => onChange(patch as Partial<PrestamoFormState>)} />
            )}

            {value.loanType === 'weekly' && (
              <PrestamoFormSemanal amount={value.amount} currency={value.currency} termWeeks={value.weeklyTermWeeks} monthlyRate={value.weeklyMonthlyRate} startDate={value.startDate} notes={value.notes} onChange={(patch) => onChange(patch as Partial<PrestamoFormState>)} />
            )}

            {value.loanType === 'carrito' && (
              <PrestamoFormCarrito amount={value.amount} currency={value.currency} flatRate={value.carritoFlatRate} term={value.carritoTerm} payments={value.carritoPayments} frequency={value.carritoFrequency} startDate={value.startDate} notes={value.notes} onChange={(patch) => onChange(patch as Partial<PrestamoFormState>)} />
            )}
          </StepPanel>

          <section className="rounded-[28px] border border-slate-200 bg-slate-950 px-4 py-5 text-white shadow-[0_16px_42px_rgba(2,6,23,.35)] sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Revisión final</p>
                <h3 className="mt-1 text-lg font-bold text-white">Confianza antes de guardar</h3>
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
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Interés total</p>
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
        <div className="mb-3 rounded-2xl bg-slate-100 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Estado del préstamo</p>
              <p className="truncate text-sm font-semibold text-slate-800">
                {canSave ? 'Todo listo para guardar con confianza' : readinessItems[0]}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Total</p>
              <p className="text-sm font-bold text-slate-900">{formatCurrency(preview.totalPayment, value.currency)}</p>
            </div>
          </div>
          {!canSave && readinessItems.length > 1 ? (
            <p className="mt-2 text-xs text-slate-500">También falta: {readinessItems.slice(1).join(' · ')}</p>
          ) : null}
        </div>
        {error && (
          <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onSubmit} disabled={!canSave} className="min-h-12 rounded-2xl px-4 text-sm font-bold text-white transition-opacity disabled:opacity-40 sm:order-2" style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
            {isSubmitting ? 'Guardando...' : canSave ? 'Guardar préstamo' : 'Completa los datos clave'}
          </button>
          <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:order-1">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

