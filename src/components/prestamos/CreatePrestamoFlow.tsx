'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  calculateCarritoLoan,
  calculateLoan,
  calculateWeeklyLoan,
  getRiskConfig,
} from '@/lib/loan'
import PrestamoForm from './PrestamoForm'
import type { PrestamoClientOption, PrestamoFormState, PrestamoPreview } from './types'

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

const DEFAULT_FORM: PrestamoFormState = {
  clientId: '',
  loanType: 'weekly',
  amount: 25000,
  currency: 'DOP',
  startDate: getTodayIsoDate(),
  notes: '',
  monthlyTermMonths: 12,
  monthlyProfile: 'Medium Risk',
  monthlyRateMode: 'annual',
  monthlyCustomRate: 0.05,
  weeklyTermWeeks: 12,
  weeklyMonthlyRate: 0.2,
  carritoFlatRate: 0.2,
  carritoTerm: 12,
  carritoPayments: 12,
  carritoFrequency: 'weekly',
}

export default function CreatePrestamoFlow({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (loanId: string) => void
}) {
  const [clients, setClients] = useState<PrestamoClientOption[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [form, setForm] = useState<PrestamoFormState>(DEFAULT_FORM)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return

    setLoadingClients(true)
    fetch('/api/clients')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar los clientes')

        setClients(
          (data.clients ?? []).map((client: any) => ({
            id: client.id,
            name: client.name,
            email: client.email ?? '',
            phone: client.phone ?? '',
            branchName: client.branchName ?? null,
          })),
        )
      })
      .catch(() => setError('No se pudieron cargar los clientes disponibles.'))
      .finally(() => setLoadingClients(false))
  }, [open])

  useEffect(() => {
    if (!open) {
      setError('')
      setIsSubmitting(false)
    }
  }, [open])

  const preview = useMemo<PrestamoPreview>(() => {
    if (form.loanType === 'amortized') {
      const result = calculateLoan({
        amount: form.amount,
        termYears: form.monthlyTermMonths / 12,
        profile: form.monthlyProfile,
        currency: form.currency,
        rateMode: form.monthlyRateMode,
        customMonthlyRate: form.monthlyRateMode === 'monthly' ? form.monthlyCustomRate : undefined,
      })

      return {
        frequencyLabel: 'Mensual',
        installments: result.totalMonths,
        scheduledPayment: result.monthlyPayment,
        totalPayment: result.totalPayment,
        totalInterest: result.totalInterest,
        rateLabel:
          form.monthlyRateMode === 'monthly'
            ? `${(form.monthlyCustomRate * 100).toFixed(2)}% mensual`
            : `${(getRiskConfig(form.monthlyProfile).midRate * 100).toFixed(2)}% anual`,
      }
    }

    if (form.loanType === 'weekly') {
      const result = calculateWeeklyLoan(form.amount, form.weeklyTermWeeks, form.weeklyMonthlyRate)
      return {
        frequencyLabel: 'Semanal',
        installments: result.totalWeeks,
        scheduledPayment: result.weeklyPayment,
        totalPayment: result.totalPayment,
        totalInterest: result.totalInterest,
        rateLabel: `${(form.weeklyMonthlyRate * 100).toFixed(2)}% mensual`,
      }
    }

    const result = calculateCarritoLoan(
      form.amount,
      form.carritoFlatRate,
      form.carritoTerm,
      form.carritoPayments,
    )
    return {
      frequencyLabel: form.carritoFrequency === 'daily' ? 'Diaria' : 'Semanal',
      installments: result.numPayments,
      scheduledPayment: result.fixedPayment,
      totalPayment: result.totalPayment,
      totalInterest: result.totalInterest,
      rateLabel: `${(form.carritoFlatRate * 100).toFixed(2)}% plana`,
    }
  }, [form])

  function updateForm(patch: Partial<PrestamoFormState>) {
    setForm((current) => ({ ...current, ...patch }))
    setError('')
  }

  function validateForm() {
    if (!form.clientId) return 'Selecciona un cliente antes de guardar el prestamo.'
    if (!form.amount || form.amount <= 0) return 'Ingresa un monto valido.'
    if (!form.startDate) return 'Selecciona la fecha de inicio.'

    if (form.loanType === 'amortized') {
      if (form.monthlyTermMonths < 1) return 'El plazo mensual debe ser de al menos 1 mes.'
      if (form.monthlyRateMode === 'monthly' && form.monthlyCustomRate < 0) {
        return 'La tasa mensual no puede ser negativa.'
      }
    }

    if (form.loanType === 'weekly') {
      if (form.weeklyTermWeeks < 1) return 'El plazo semanal debe ser de al menos 1 semana.'
      if (form.weeklyMonthlyRate < 0) return 'La tasa semanal no puede ser negativa.'
    }

    if (form.loanType === 'carrito') {
      if (form.carritoTerm < 1) return 'El plazo de carrito debe ser mayor que cero.'
      if (form.carritoPayments < 1) return 'Las cuotas de carrito deben ser mayores que cero.'
      if (form.carritoFlatRate < 0) return 'La tasa plana no puede ser negativa.'
    }

    return ''
  }

  async function handleSubmit() {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const payload = buildPayload(form)
      const response = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo guardar el prestamo.')
      }

      setForm(DEFAULT_FORM)
      onCreated(data.loanId)
      onClose()
    } catch (submissionError: any) {
      setError(submissionError?.message ?? 'No se pudo guardar el prestamo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-[2px]">
      <div className="flex h-full w-full items-end justify-end sm:items-stretch">
        <div className="flex h-[92vh] w-full flex-col rounded-t-[28px] bg-slate-50 sm:h-full sm:max-w-3xl sm:rounded-none sm:border-l sm:border-slate-200">
          <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Prestamos</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Crear nuevo prestamo</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Flujo rapido para originar un prestamo desde esta misma seccion.
                </p>
              </div>
              <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50" aria-label="Cerrar">
                x
              </button>
            </div>
          </div>

          {loadingClients ? (
            <div className="flex flex-1 items-center justify-center px-6">
              <div className="text-center text-sm text-slate-500">Cargando clientes...</div>
            </div>
          ) : (
            <PrestamoForm clients={clients} value={form} preview={preview} error={error} isSubmitting={isSubmitting} onChange={updateForm} onSubmit={handleSubmit} onCancel={onClose} />
          )}
        </div>
      </div>
    </div>
  )
}

function buildPayload(form: PrestamoFormState) {
  if (form.loanType === 'amortized') {
    const result = calculateLoan({
      amount: form.amount,
      termYears: form.monthlyTermMonths / 12,
      profile: form.monthlyProfile,
      currency: form.currency,
      rateMode: form.monthlyRateMode,
      customMonthlyRate: form.monthlyRateMode === 'monthly' ? form.monthlyCustomRate : undefined,
      startDate: form.startDate,
    })

    return {
      clientId: form.clientId,
      loanType: 'amortized',
      currency: form.currency,
      amount: form.amount,
      termYears: form.monthlyTermMonths / 12,
      profile: form.monthlyProfile,
      rateMode: form.monthlyRateMode,
      customMonthlyRate: form.monthlyRateMode === 'monthly' ? form.monthlyCustomRate : undefined,
      annualRate: result.annualRate,
      monthlyRate: result.monthlyRate,
      totalMonths: result.totalMonths,
      scheduledPayment: result.monthlyPayment,
      totalPayment: result.totalPayment,
      totalInterest: result.totalInterest,
      startDate: form.startDate,
      notes: form.notes.trim() || undefined,
    }
  }

  if (form.loanType === 'weekly') {
    const result = calculateWeeklyLoan(form.amount, form.weeklyTermWeeks, form.weeklyMonthlyRate)

    return {
      clientId: form.clientId,
      loanType: 'weekly',
      currency: form.currency,
      amount: form.amount,
      termWeeks: form.weeklyTermWeeks,
      monthlyRate: form.weeklyMonthlyRate,
      weeklyRate: result.weeklyRate,
      totalWeeks: result.totalWeeks,
      annualRate: result.annualRate,
      scheduledPayment: result.weeklyPayment,
      totalPayment: result.totalPayment,
      totalInterest: result.totalInterest,
      startDate: form.startDate,
      notes: form.notes.trim() || undefined,
    }
  }

  const result = calculateCarritoLoan(
    form.amount,
    form.carritoFlatRate,
    form.carritoTerm,
    form.carritoPayments,
  )

  return {
    clientId: form.clientId,
    loanType: 'carrito',
    currency: form.currency,
    amount: form.amount,
    carritoTerm: form.carritoTerm,
    carritoPayments: form.carritoPayments,
    carritoFrequency: form.carritoFrequency,
    scheduledPayment: result.fixedPayment,
    totalPayment: result.totalPayment,
    totalInterest: result.totalInterest,
    startDate: form.startDate,
    notes: form.notes.trim() || undefined,
  }
}

