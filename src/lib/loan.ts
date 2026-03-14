import {
  calculateLoanQuote,
  type InterestMethod,
  type LoanEngineResult,
  type LoanEngineScheduleRow,
  type PaymentFrequency,
  type RateUnit,
  inferLegacyInterestMethod,
  inferLegacyPaymentFrequency,
} from './loanEngine'

export type RiskProfile = 'Low Risk' | 'Medium Risk' | 'High Risk'

export interface RiskConfig {
  label: RiskProfile
  minRate: number
  midRate: number
  maxRate: number
  description: string
  emoji: string
  colorBg: string
  colorText: string
  colorAccent: string
  activeClass: string
}

export const RISK_PROFILES: RiskConfig[] = [
  {
    label: 'Low Risk', minRate: 0.05, midRate: 0.06, maxRate: 0.07,
    description: 'Creditworthy borrowers, stable income & strong collateral',
    emoji: '🟢', colorBg: '#E8F5E9', colorText: '#1B5E20', colorAccent: '#2E7D32',
    activeClass: 'ring-2 ring-green-500 bg-green-50 border-green-500',
  },
  {
    label: 'Medium Risk', minRate: 0.08, midRate: 0.09, maxRate: 0.10,
    description: 'Average credit profile, some income variability',
    emoji: '🟡', colorBg: '#FFF8E1', colorText: '#6D4C00', colorAccent: '#F59E0B',
    activeClass: 'ring-2 ring-amber-400 bg-amber-50 border-amber-400',
  },
  {
    label: 'High Risk', minRate: 0.13, midRate: 0.14, maxRate: 0.15,
    description: 'Elevated credit risk, limited collateral or credit history',
    emoji: '🔴', colorBg: '#FFEBEE', colorText: '#B71C1C', colorAccent: '#EF4444',
    activeClass: 'ring-2 ring-red-500 bg-red-50 border-red-500',
  },
]

export function getRiskConfig(profile: RiskProfile): RiskConfig {
  return RISK_PROFILES.find((risk) => risk.label === profile)!
}

export type RateMode = 'annual' | 'monthly'
export type Currency = 'USD' | 'ARS' | 'EUR' | 'DOP'

export interface CurrencyConfig {
  code: Currency
  symbol: string
  label: string
  locale: string
  flag: string
}

export const CURRENCIES: Record<Currency, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', label: 'USD', locale: 'en-US', flag: '🇺🇸' },
  ARS: { code: 'ARS', symbol: '$', label: 'ARS', locale: 'es-AR', flag: '🇦🇷' },
  EUR: { code: 'EUR', symbol: '€', label: 'EUR', locale: 'de-DE', flag: '🇪🇺' },
  DOP: { code: 'DOP', symbol: 'RD$', label: 'DOP', locale: 'es-DO', flag: '🇩🇴' },
}

export function formatCurrency(value: number, currency: Currency): string {
  const config = CURRENCIES[currency]
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value: number, decimals = 2): string {
  return (value * 100).toFixed(decimals) + '%'
}

export interface LoanParams {
  amount: number
  termYears: number
  profile: RiskProfile
  currency: Currency
  rateMode?: RateMode
  customMonthlyRate?: number
  startDate?: string
}

export interface LoanResult {
  annualRate: number
  monthlyRate: number
  totalMonths: number
  monthlyPayment: number
  totalPayment: number
  totalInterest: number
  interestRatio: number
}

function toLegacyResult(result: LoanEngineResult, annualRate: number, monthlyRate: number, totalMonths: number): LoanResult {
  return {
    annualRate,
    monthlyRate,
    totalMonths,
    monthlyPayment: result.periodicPayment,
    totalPayment: result.totalPayable,
    totalInterest: result.totalInterest,
    interestRatio: result.principal > 0 ? result.totalInterest / result.principal : 0,
  }
}

export function calculateLoan(params: LoanParams): LoanResult {
  const { amount, termYears, profile, rateMode = 'annual', customMonthlyRate, startDate } = params
  const config = getRiskConfig(profile)

  const monthlyRate =
    rateMode === 'monthly' && customMonthlyRate != null && customMonthlyRate >= 0
      ? customMonthlyRate
      : config.midRate / 12

  const annualRate = rateMode === 'monthly' ? monthlyRate * 12 : config.midRate
  const totalMonths = Math.max(1, Math.round(termYears * 12))
  const result = calculateLoanQuote({
    principal: amount,
    interestMethod: 'DECLINING_BALANCE',
    installmentCount: totalMonths,
    paymentFrequency: 'MONTHLY',
    rateValue: monthlyRate,
    rateUnit: 'DECIMAL',
    startDate,
  })

  return toLegacyResult(result, annualRate, monthlyRate, totalMonths)
}

export interface AmortizationRow {
  month: number
  openingBalance: number
  payment: number
  principal: number
  interest: number
  closingBalance: number
  cumInterest: number
  cumPrincipal: number
}

function toAmortizationRows(schedule: LoanEngineScheduleRow[]): AmortizationRow[] {
  let cumInterest = 0
  let cumPrincipal = 0

  return schedule.map((row) => {
    cumInterest += row.interestAmount
    cumPrincipal += row.principalAmount

    return {
      month: row.installmentNumber,
      openingBalance: row.openingBalance,
      payment: row.paymentAmount,
      principal: row.principalAmount,
      interest: row.interestAmount,
      closingBalance: row.closingBalance,
      cumInterest,
      cumPrincipal,
    }
  })
}

export function buildAmortization(params: LoanParams): AmortizationRow[] {
  const result = calculateLoan(params)
  return toAmortizationRows(
    calculateLoanQuote({
      principal: params.amount,
      interestMethod: 'DECLINING_BALANCE',
      installmentCount: result.totalMonths,
      paymentFrequency: 'MONTHLY',
      rateValue: result.monthlyRate,
      rateUnit: 'DECIMAL',
      startDate: params.startDate,
    }).schedule,
  )
}

export type LoanType = 'amortized' | 'weekly' | 'carrito'

export const LOAN_TYPES: { id: LoanType; label: string; emoji: string; description: string }[] = [
  { id: 'amortized', emoji: '📅', label: 'Amortizado', description: 'Cuotas mensuales, saldo reducible' },
  { id: 'weekly', emoji: '📆', label: 'Semanal', description: 'Saldo reducible, cuotas semanales' },
  { id: 'carrito', emoji: '🛒', label: 'Carrito', description: 'Interés configurable, cobro diario o semanal' },
]

export interface PaymentScheduleRow {
  period: number
  dueDate: string
  payment: number
  principal: number
  interest: number
  balance: number
  cumInterest: number
  cumPrincipal: number
}

export interface WeeklyLoanResult {
  weeklyRate: number
  monthlyRate: number
  annualRate: number
  totalWeeks: number
  weeklyPayment: number
  totalPayment: number
  totalInterest: number
  interestRatio: number
}

export function calculateWeeklyLoan(amount: number, termWeeks: number, monthlyRate: number): WeeklyLoanResult {
  const weeklyRate = monthlyRate / 4.33
  const annualRate = monthlyRate * 12
  const result = calculateLoanQuote({
    principal: amount,
    interestMethod: 'DECLINING_BALANCE',
    installmentCount: Math.max(1, termWeeks),
    paymentFrequency: 'WEEKLY',
    rateValue: weeklyRate,
    rateUnit: 'DECIMAL',
  })

  return {
    weeklyRate,
    monthlyRate,
    annualRate,
    totalWeeks: Math.max(1, termWeeks),
    weeklyPayment: result.periodicPayment,
    totalPayment: result.totalPayable,
    totalInterest: result.totalInterest,
    interestRatio: result.principal > 0 ? result.totalInterest / result.principal : 0,
  }
}

function toPaymentScheduleRows(schedule: LoanEngineScheduleRow[]): PaymentScheduleRow[] {
  let cumInterest = 0
  let cumPrincipal = 0

  return schedule.map((row) => {
    cumInterest += row.interestAmount
    cumPrincipal += row.principalAmount

    return {
      period: row.installmentNumber,
      dueDate: row.dueDate,
      payment: row.paymentAmount,
      principal: row.principalAmount,
      interest: row.interestAmount,
      balance: row.closingBalance,
      cumInterest,
      cumPrincipal,
    }
  })
}

export function buildWeeklySchedule(amount: number, termWeeks: number, monthlyRate: number, startDate: Date = new Date()): PaymentScheduleRow[] {
  return toPaymentScheduleRows(
    calculateLoanQuote({
      principal: amount,
      interestMethod: 'DECLINING_BALANCE',
      installmentCount: Math.max(1, termWeeks),
      paymentFrequency: 'WEEKLY',
      rateValue: monthlyRate / 4.33,
      rateUnit: 'DECIMAL',
      startDate: startDate.toISOString().slice(0, 10),
    }).schedule,
  )
}

export type CarritoFrequency = 'daily' | 'weekly'

export interface CarritoLoanResult {
  flatRate: number
  totalInterest: number
  totalPayment: number
  fixedPayment: number
  numPayments: number
  interestRatio: number
  interestMethod: InterestMethod
}

export function calculateCarritoLoan(
  amount: number,
  flatRate: number,
  term: number,
  numPayments: number,
  interestMethod: InterestMethod = 'FLAT_TOTAL',
): CarritoLoanResult {
  const method = interestMethod === 'FLAT_PER_PERIOD' ? 'FLAT_PER_PERIOD' : interestMethod === 'ZERO_INTEREST' ? 'ZERO_INTEREST' : 'FLAT_TOTAL'
  const result = calculateLoanQuote({
    principal: amount,
    interestMethod: method,
    installmentCount: Math.max(1, numPayments),
    interestPeriodCount: method === 'FLAT_PER_PERIOD' ? Math.max(1, term) : 1,
    paymentFrequency: 'WEEKLY',
    rateValue: flatRate,
    rateUnit: 'DECIMAL',
  })

  return {
    flatRate,
    totalInterest: result.totalInterest,
    totalPayment: result.totalPayable,
    fixedPayment: result.periodicPayment,
    numPayments: Math.max(1, numPayments),
    interestRatio: result.principal > 0 ? result.totalInterest / result.principal : 0,
    interestMethod: method,
  }
}

export function buildCarritoSchedule(
  amount: number,
  flatRate: number,
  term: number,
  numPayments: number,
  frequency: CarritoFrequency = 'weekly',
  startDate: Date = new Date(),
  interestMethod: InterestMethod = 'FLAT_TOTAL',
): PaymentScheduleRow[] {
  return toPaymentScheduleRows(
    calculateLoanQuote({
      principal: amount,
      interestMethod: interestMethod === 'FLAT_PER_PERIOD' ? 'FLAT_PER_PERIOD' : interestMethod === 'ZERO_INTEREST' ? 'ZERO_INTEREST' : 'FLAT_TOTAL',
      installmentCount: Math.max(1, numPayments),
      interestPeriodCount: interestMethod === 'FLAT_PER_PERIOD' ? Math.max(1, term) : 1,
      paymentFrequency: frequency === 'daily' ? 'DAILY' : 'WEEKLY',
      rateValue: flatRate,
      rateUnit: 'DECIMAL',
      startDate: startDate.toISOString().slice(0, 10),
    }).schedule,
  )
}

export type Branch = 'sede' | 'rutas'

export interface ClientDocument {
  id: string
  name: string
  url: string
  type: string
  size: number
  uploadedAt: string
}

export interface Client {
  id: string
  name: string
  email: string
  phone: string
  notes: string
  branch: Branch
  params: LoanParams
  result: LoanResult
  savedAt: string
  documents?: ClientDocument[]
}

export interface LoanSlot {
  id: string
  label: string
  color: string
  params: LoanParams
  result: LoanResult
}

export {
  calculateLoanQuote,
  inferLegacyInterestMethod,
  inferLegacyPaymentFrequency,
  type InterestMethod,
  type PaymentFrequency,
  type RateUnit,
}
