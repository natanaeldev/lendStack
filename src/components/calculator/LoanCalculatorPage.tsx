'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CarritoFrequency, Currency, LoanType, RateMode } from '@/lib/loan'
import { CURRENCIES, calculateCarritoLoan, calculateLoan, calculateWeeklyLoan, formatCurrency, formatPercent } from '@/lib/loan'
import CalculatorActions from './CalculatorActions'
import CalculatorInputField from './CalculatorInputField'
import CalculatorResultsCard from './CalculatorResultsCard'
import LoanSummary from './LoanSummary'
import LoanTypeSelector, { type CalculatorLoanKind } from './LoanTypeSelector'

function nextDueLabel(kind: CalculatorLoanKind, frequency: CarritoFrequency) {
  const date = new Date()
  if (kind === 'weekly') date.setDate(date.getDate() + 7)
  else if (kind === 'monthly' || kind === 'amortized') date.setMonth(date.getMonth() + 1)
  else date.setDate(date.getDate() + (frequency === 'daily' ? 1 : 7))
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short' }).format(date)
}

function getUiType(loanType: LoanType, rateMode: RateMode, termUnit: 'years' | 'months'): CalculatorLoanKind {
  if (loanType === 'weekly') return 'weekly'
  if (loanType === 'carrito') return 'carrito'
  if (rateMode === 'monthly' && termUnit === 'months') return 'monthly'
  return 'amortized'
}

const inputCls = 'w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100'

export default function LoanCalculatorPage({
  amount, onAmountChange,
  currency, onCurrencyChange,
  loanType, onLoanTypeChange,
  termUnit, termValue, onTermUnitChange, onTermValueChange,
  rateMode, onRateModeChange, customMonthlyRate, onCustomMonthlyRateChange,
  weeklyTermWeeks, onWeeklyTermWeeksChange, weeklyMonthlyRate, onWeeklyMonthlyRateChange,
  carritoFlatRate, onCarritoFlatRateChange, carritoTerm, onCarritoTermChange, carritoPayments, onCarritoPaymentsChange, carritoFreq, onCarritoFreqChange,
}: {
  amount: number
  onAmountChange: (value: number) => void
  currency: Currency
  onCurrencyChange: (value: Currency) => void
  loanType: LoanType
  onLoanTypeChange: (value: LoanType) => void
  termUnit: 'years' | 'months'
  termValue: number
  onTermUnitChange: (value: 'years' | 'months') => void
  onTermValueChange: (value: number) => void
  rateMode: RateMode
  onRateModeChange: (value: RateMode) => void
  customMonthlyRate: number
  onCustomMonthlyRateChange: (value: number) => void
  weeklyTermWeeks: number
  onWeeklyTermWeeksChange: (value: number) => void
  weeklyMonthlyRate: number
  onWeeklyMonthlyRateChange: (value: number) => void
  carritoFlatRate: number
  onCarritoFlatRateChange: (value: number) => void
  carritoTerm: number
  onCarritoTermChange: (value: number) => void
  carritoPayments: number
  onCarritoPaymentsChange: (value: number) => void
  carritoFreq: CarritoFrequency
  onCarritoFreqChange: (value: CarritoFrequency) => void
}) {
  const [hasCalculated, setHasCalculated] = useState(true)

  const uiType = useMemo(() => getUiType(loanType, rateMode, termUnit), [loanType, rateMode, termUnit])

  useEffect(() => {
    setHasCalculated(true)
  }, [uiType, amount, currency, termValue, termUnit, customMonthlyRate, weeklyMonthlyRate, weeklyTermWeeks, carritoFlatRate, carritoTerm, carritoPayments, carritoFreq])

  const amortizedResult = useMemo(() => calculateLoan({ amount, termYears: termUnit === 'months' ? termValue / 12 : termValue, profile: 'Medium Risk', currency, rateMode, customMonthlyRate }), [amount, currency, customMonthlyRate, rateMode, termUnit, termValue])
  const weeklyResult = useMemo(() => calculateWeeklyLoan(amount, weeklyTermWeeks, weeklyMonthlyRate), [amount, weeklyMonthlyRate, weeklyTermWeeks])
  const carritoResult = useMemo(() => calculateCarritoLoan(amount, carritoFlatRate, carritoTerm, carritoPayments), [amount, carritoFlatRate, carritoPayments, carritoTerm])

  const activeResult = uiType === 'weekly' ? weeklyResult : uiType === 'carrito' ? carritoResult : amortizedResult

  const results = useMemo(() => {
    if (uiType === 'weekly') {
      return {
        installmentLabel: 'Cuota semanal',
        installmentValue: formatCurrency(weeklyResult.weeklyPayment, currency),
        totalValue: formatCurrency(weeklyResult.totalPayment, currency),
        interestValue: formatCurrency(weeklyResult.totalInterest, currency),
        summary: `Semanal a ${formatPercent(weeklyResult.monthlyRate)} mensual durante ${weeklyResult.totalWeeks} semanas.`,
        items: [
          { label: 'Pagos', value: String(weeklyResult.totalWeeks) },
          { label: 'Frecuencia', value: 'Semanal' },
          { label: 'Primera fecha', value: nextDueLabel('weekly', carritoFreq) },
          { label: 'Tasa usada', value: `${formatPercent(weeklyResult.monthlyRate)} mensual` },
        ],
      }
    }
    if (uiType === 'carrito') {
      return {
        installmentLabel: carritoFreq === 'daily' ? 'Pago diario' : 'Pago semanal',
        installmentValue: formatCurrency(carritoResult.fixedPayment, currency),
        totalValue: formatCurrency(carritoResult.totalPayment, currency),
        interestValue: formatCurrency(carritoResult.totalInterest, currency),
        summary: `Carrito con inter?s plano de ${formatPercent(carritoFlatRate)} durante ${carritoTerm} periodos.`,
        items: [
          { label: 'Pagos', value: String(carritoPayments) },
          { label: 'Frecuencia', value: carritoFreq === 'daily' ? 'Diaria' : 'Semanal' },
          { label: 'Primera fecha', value: nextDueLabel('carrito', carritoFreq) },
          { label: 'Tasa usada', value: `${formatPercent(carritoFlatRate)} plana` },
        ],
      }
    }
    if (uiType === 'monthly') {
      return {
        installmentLabel: 'Cuota mensual',
        installmentValue: formatCurrency(amortizedResult.monthlyPayment, currency),
        totalValue: formatCurrency(amortizedResult.totalPayment, currency),
        interestValue: formatCurrency(amortizedResult.totalInterest, currency),
        summary: `Simulaci?n mensual con ${termValue} meses y tasa de ${formatPercent(customMonthlyRate)} por mes.`,
        items: [
          { label: 'Pagos', value: String(amortizedResult.totalMonths) },
          { label: 'Frecuencia', value: 'Mensual' },
          { label: 'Primera fecha', value: nextDueLabel('monthly', carritoFreq) },
          { label: 'Tasa usada', value: `${formatPercent(customMonthlyRate)} mensual` },
        ],
      }
    }
    return {
      installmentLabel: 'Cuota',
      installmentValue: formatCurrency(amortizedResult.monthlyPayment, currency),
      totalValue: formatCurrency(amortizedResult.totalPayment, currency),
      interestValue: formatCurrency(amortizedResult.totalInterest, currency),
      summary: `Amortizado institucional con ${termValue} ${termUnit === 'years' ? 'a?os' : 'meses'} y ${rateMode === 'annual' ? 'tasa anual' : 'tasa mensual'}.`,
      items: [
        { label: 'Pagos', value: String(amortizedResult.totalMonths) },
        { label: 'Frecuencia', value: 'Mensual' },
        { label: 'Primera fecha', value: nextDueLabel('amortized', carritoFreq) },
        { label: 'Tasa usada', value: rateMode === 'annual' ? `${formatPercent(amortizedResult.annualRate)} anual` : `${formatPercent(customMonthlyRate)} mensual` },
      ],
    }
  }, [amortizedResult, carritoFlatRate, carritoFreq, carritoResult, carritoTerm, carritoPayments, currency, customMonthlyRate, rateMode, termUnit, termValue, uiType, weeklyResult])

  const handleLoanKindChange = (next: CalculatorLoanKind) => {
    if (next === 'weekly') {
      onLoanTypeChange('weekly')
      return
    }
    if (next === 'carrito') {
      onLoanTypeChange('carrito')
      return
    }
    onLoanTypeChange('amortized')
    if (next === 'monthly') {
      onRateModeChange('monthly')
      if (termUnit !== 'months') onTermUnitChange('months')
      if (termValue < 1) onTermValueChange(12)
      return
    }
    onRateModeChange('annual')
    if (termUnit !== 'years') onTermUnitChange('years')
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#071A3E_0%,#0D2B5E_54%,#1565C0_100%)] p-4 text-white shadow-[0_24px_60px_rgba(7,26,62,.28)] sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">Calculadora</p>
        <h1 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">Calculadora de pr?stamos</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">Simula cuotas y condiciones r?pidamente</p>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,.95fr)]">
        <div className="space-y-4">
          <section className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,.06)] sm:p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Configuraci?n</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">Simulaci?n r?pida</h2>
            <div className="mt-4">
              <LoanTypeSelector value={uiType} onChange={handleLoanKindChange} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CalculatorInputField label="Monto del pr?stamo">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{CURRENCIES[currency].symbol}</span>
                  <input type="number" min={0} step={1000} value={amount} onChange={(event) => onAmountChange(Number(event.target.value) || 0)} inputMode="decimal" className={`${inputCls} pl-12`} />
                </div>
              </CalculatorInputField>

              <CalculatorInputField label="Moneda">
                <select value={currency} onChange={(event) => onCurrencyChange(event.target.value as Currency)} className={inputCls}>
                  {Object.entries(CURRENCIES).map(([code, config]) => (
                    <option key={code} value={code}>{config.label}</option>
                  ))}
                </select>
              </CalculatorInputField>

              {(uiType === 'amortized' || uiType === 'monthly') ? (
                <>
                  <CalculatorInputField label="Tasa de inter?s" helper={uiType === 'monthly' ? 'Porcentaje mensual' : rateMode === 'annual' ? 'Porcentaje anual' : 'Porcentaje mensual'}>
                    <div className="relative">
                      <input type="number" min={0} step={0.1} value={rateMode === 'annual' ? Number((amortizedResult.annualRate * 100).toFixed(2)) : Number((customMonthlyRate * 100).toFixed(2))} onChange={(event) => {
                        const raw = (Number(event.target.value) || 0) / 100
                        if (uiType === 'monthly') {
                          onRateModeChange('monthly')
                          onCustomMonthlyRateChange(raw)
                        } else if (rateMode === 'annual') {
                          onRateModeChange('monthly')
                          onCustomMonthlyRateChange(raw / 12)
                        } else {
                          onCustomMonthlyRateChange(raw)
                        }
                      }} inputMode="decimal" className={`${inputCls} pr-12`} />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span>
                    </div>
                  </CalculatorInputField>

                  <CalculatorInputField label="Plazo">
                    <div className="flex gap-2">
                      <input type="number" min={1} step={1} value={termValue} onChange={(event) => onTermValueChange(Math.max(1, Number(event.target.value) || 1))} inputMode="numeric" className={`${inputCls} flex-1`} />
                      <div className="inline-flex overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50">
                        {(uiType === 'monthly' ? (['months'] as const) : (['years', 'months'] as const)).map((unit) => (
                          <button key={unit} type="button" onClick={() => onTermUnitChange(unit)} className="min-h-[54px] px-4 text-sm font-bold transition" style={{ background: termUnit === unit ? '#0D2B5E' : 'transparent', color: termUnit === unit ? '#FFFFFF' : '#64748B' }}>
                            {unit === 'years' ? 'A?os' : 'Meses'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CalculatorInputField>
                </>
              ) : null}

              {uiType === 'weekly' ? (
                <>
                  <CalculatorInputField label="Tasa de inter?s" helper="Porcentaje mensual de referencia">
                    <div className="relative">
                      <input type="number" min={0} step={0.1} value={Number((weeklyMonthlyRate * 100).toFixed(2))} onChange={(event) => onWeeklyMonthlyRateChange((Number(event.target.value) || 0) / 100)} inputMode="decimal" className={`${inputCls} pr-12`} />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span>
                    </div>
                  </CalculatorInputField>
                  <CalculatorInputField label="Plazo" helper="Cantidad de semanas">
                    <input type="number" min={1} step={1} value={weeklyTermWeeks} onChange={(event) => onWeeklyTermWeeksChange(Math.max(1, Number(event.target.value) || 1))} inputMode="numeric" className={inputCls} />
                  </CalculatorInputField>
                </>
              ) : null}

              {uiType === 'carrito' ? (
                <>
                  <CalculatorInputField label="Tasa de inter?s" helper="Tasa plana por per?odo">
                    <div className="relative">
                      <input type="number" min={0} step={0.1} value={Number((carritoFlatRate * 100).toFixed(2))} onChange={(event) => onCarritoFlatRateChange((Number(event.target.value) || 0) / 100)} inputMode="decimal" className={`${inputCls} pr-12`} />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span>
                    </div>
                  </CalculatorInputField>
                  <CalculatorInputField label="Plazo" helper="Cantidad de per?odos">
                    <input type="number" min={1} step={1} value={carritoTerm} onChange={(event) => onCarritoTermChange(Math.max(1, Number(event.target.value) || 1))} inputMode="numeric" className={inputCls} />
                  </CalculatorInputField>
                  <CalculatorInputField label="Pagos">
                    <input type="number" min={1} step={1} value={carritoPayments} onChange={(event) => onCarritoPaymentsChange(Math.max(1, Number(event.target.value) || 1))} inputMode="numeric" className={inputCls} />
                  </CalculatorInputField>
                  <CalculatorInputField label="Frecuencia">
                    <div className="inline-flex w-full overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50">
                      {(['daily', 'weekly'] as const).map((value) => (
                        <button key={value} type="button" onClick={() => onCarritoFreqChange(value)} className="min-h-[54px] flex-1 px-4 text-sm font-bold transition" style={{ background: carritoFreq === value ? '#0D2B5E' : 'transparent', color: carritoFreq === value ? '#FFFFFF' : '#64748B' }}>
                          {value === 'daily' ? 'Diario' : 'Semanal'}
                        </button>
                      ))}
                    </div>
                  </CalculatorInputField>
                </>
              ) : null}
            </div>

            <div className="mt-5">
              <CalculatorActions onCalculate={() => setHasCalculated(true)} />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          {hasCalculated ? (
            <>
              <CalculatorResultsCard
                installmentLabel={results.installmentLabel}
                installmentValue={results.installmentValue}
                totalValue={results.totalValue}
                interestValue={results.interestValue}
                summary={results.summary}
              />
              <LoanSummary items={results.items} />
            </>
          ) : null}

          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,.06)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Vista r?pida</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Esta simulaci?n usa las f?rmulas existentes de LendStack para mostrar una cuota confiable en campo, con formato claro y listo para conversar con el cliente.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
