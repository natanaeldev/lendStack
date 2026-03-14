export type InterestMethod =
  | 'FLAT_TOTAL'
  | 'FLAT_PER_PERIOD'
  | 'DECLINING_BALANCE'
  | 'INTEREST_ONLY'
  | 'ZERO_INTEREST'

export type PaymentFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM'
export type RateUnit = 'PERCENT' | 'DECIMAL'
export type TermUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS'

export interface LoanEngineInput {
  principal: number
  interestMethod: InterestMethod
  installmentCount: number
  paymentFrequency: PaymentFrequency
  rateValue?: number
  rateUnit?: RateUnit
  interestPeriodCount?: number
  startDate?: string
  customFrequencyDays?: number
}

export interface LoanEngineScheduleRow {
  installmentNumber: number
  dueDate: string
  openingBalance: number
  paymentAmount: number
  principalAmount: number
  interestAmount: number
  closingBalance: number
}

export interface LoanEngineResult {
  principal: number
  interestMethod: InterestMethod
  paymentFrequency: PaymentFrequency
  installmentCount: number
  rateDecimal: number
  interestPeriodCount: number
  totalInterest: number
  totalPayable: number
  periodicPayment: number
  schedule: LoanEngineScheduleRow[]
}

function assertMoney(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite number greater than or equal to 0.`)
  }
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be an integer greater than or equal to 1.`)
  }
}

function normalizeRate(value: number | undefined, unit: RateUnit = 'DECIMAL') {
  const safeValue = value ?? 0
  if (!Number.isFinite(safeValue) || safeValue < 0) {
    throw new Error('Rate value must be a finite number greater than or equal to 0.')
  }
  return unit === 'PERCENT' ? safeValue / 100 : safeValue
}

function cents(value: number) {
  return Math.round(value * 100)
}

function fromCents(value: number) {
  return value / 100
}

function roundCurrency(value: number) {
  return fromCents(cents(value))
}

function distributeAcrossInstallments(total: number, count: number) {
  const totalCents = cents(total)
  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count
  return Array.from({ length: count }, (_, index) => fromCents(base + (index === count - 1 ? remainder : 0)))
}

function addFrequency(date: Date, paymentFrequency: PaymentFrequency, count: number, customFrequencyDays?: number) {
  const next = new Date(date)
  if (paymentFrequency === 'DAILY') {
    next.setDate(next.getDate() + count)
    return next
  }
  if (paymentFrequency === 'WEEKLY') {
    next.setDate(next.getDate() + count * 7)
    return next
  }
  if (paymentFrequency === 'BIWEEKLY') {
    next.setDate(next.getDate() + count * 14)
    return next
  }
  if (paymentFrequency === 'CUSTOM') {
    next.setDate(next.getDate() + count * Math.max(customFrequencyDays ?? 1, 1))
    return next
  }
  next.setMonth(next.getMonth() + count)
  return next
}

function buildDueDate(startDate: string | undefined, paymentFrequency: PaymentFrequency, installmentNumber: number, customFrequencyDays?: number) {
  const base = startDate ? new Date(`${startDate}T12:00:00`) : new Date()
  if (Number.isNaN(base.getTime())) {
    throw new Error('startDate must be a valid ISO date when provided.')
  }
  return addFrequency(base, paymentFrequency, installmentNumber, customFrequencyDays).toISOString().slice(0, 10)
}

function buildFlatSchedule(input: LoanEngineInput, rateDecimal: number, interestPeriodCount: number, totalInterest: number): LoanEngineResult {
  const principalParts = distributeAcrossInstallments(input.principal, input.installmentCount)
  const interestParts = distributeAcrossInstallments(totalInterest, input.installmentCount)
  const schedule: LoanEngineScheduleRow[] = []
  let openingBalance = roundCurrency(input.principal)

  for (let index = 0; index < input.installmentCount; index++) {
    const principalAmount = principalParts[index]
    const interestAmount = interestParts[index]
    const paymentAmount = roundCurrency(principalAmount + interestAmount)
    const closingBalance = roundCurrency(Math.max(openingBalance - principalAmount, 0))

    schedule.push({
      installmentNumber: index + 1,
      dueDate: buildDueDate(input.startDate, input.paymentFrequency, index + 1, input.customFrequencyDays),
      openingBalance,
      paymentAmount,
      principalAmount,
      interestAmount,
      closingBalance,
    })

    openingBalance = closingBalance
  }

  const totalPayable = roundCurrency(schedule.reduce((sum, row) => sum + row.paymentAmount, 0))
  return {
    principal: roundCurrency(input.principal),
    interestMethod: input.interestMethod,
    paymentFrequency: input.paymentFrequency,
    installmentCount: input.installmentCount,
    rateDecimal,
    interestPeriodCount,
    totalInterest: roundCurrency(schedule.reduce((sum, row) => sum + row.interestAmount, 0)),
    totalPayable,
    periodicPayment: schedule[0]?.paymentAmount ?? 0,
    schedule,
  }
}

function buildZeroInterestSchedule(input: LoanEngineInput, rateDecimal: number): LoanEngineResult {
  const principalParts = distributeAcrossInstallments(input.principal, input.installmentCount)
  const schedule: LoanEngineScheduleRow[] = []
  let openingBalance = roundCurrency(input.principal)

  for (let index = 0; index < input.installmentCount; index++) {
    const principalAmount = principalParts[index]
    const closingBalance = roundCurrency(Math.max(openingBalance - principalAmount, 0))

    schedule.push({
      installmentNumber: index + 1,
      dueDate: buildDueDate(input.startDate, input.paymentFrequency, index + 1, input.customFrequencyDays),
      openingBalance,
      paymentAmount: principalAmount,
      principalAmount,
      interestAmount: 0,
      closingBalance,
    })

    openingBalance = closingBalance
  }

  return {
    principal: roundCurrency(input.principal),
    interestMethod: 'ZERO_INTEREST',
    paymentFrequency: input.paymentFrequency,
    installmentCount: input.installmentCount,
    rateDecimal,
    interestPeriodCount: input.installmentCount,
    totalInterest: 0,
    totalPayable: roundCurrency(schedule.reduce((sum, row) => sum + row.paymentAmount, 0)),
    periodicPayment: schedule[0]?.paymentAmount ?? 0,
    schedule,
  }
}

function buildDecliningBalanceSchedule(input: LoanEngineInput, rateDecimal: number): LoanEngineResult {
  if (rateDecimal === 0) return buildZeroInterestSchedule(input, rateDecimal)

  const schedule: LoanEngineScheduleRow[] = []
  const periodicPaymentRaw =
    (input.principal * (rateDecimal * Math.pow(1 + rateDecimal, input.installmentCount))) /
    (Math.pow(1 + rateDecimal, input.installmentCount) - 1)
  const standardPayment = roundCurrency(periodicPaymentRaw)
  let openingBalance = roundCurrency(input.principal)

  for (let index = 0; index < input.installmentCount; index++) {
    const interestAmount = roundCurrency(openingBalance * rateDecimal)
    const isLast = index === input.installmentCount - 1
    const principalAmount = isLast ? openingBalance : roundCurrency(Math.min(standardPayment - interestAmount, openingBalance))
    const paymentAmount = roundCurrency(principalAmount + interestAmount)
    const closingBalance = roundCurrency(Math.max(openingBalance - principalAmount, 0))

    schedule.push({
      installmentNumber: index + 1,
      dueDate: buildDueDate(input.startDate, input.paymentFrequency, index + 1, input.customFrequencyDays),
      openingBalance,
      paymentAmount,
      principalAmount,
      interestAmount,
      closingBalance,
    })

    openingBalance = closingBalance
  }

  return {
    principal: roundCurrency(input.principal),
    interestMethod: 'DECLINING_BALANCE',
    paymentFrequency: input.paymentFrequency,
    installmentCount: input.installmentCount,
    rateDecimal,
    interestPeriodCount: input.installmentCount,
    totalInterest: roundCurrency(schedule.reduce((sum, row) => sum + row.interestAmount, 0)),
    totalPayable: roundCurrency(schedule.reduce((sum, row) => sum + row.paymentAmount, 0)),
    periodicPayment: schedule[0]?.paymentAmount ?? 0,
    schedule,
  }
}

function buildInterestOnlySchedule(input: LoanEngineInput, rateDecimal: number): LoanEngineResult {
  const schedule: LoanEngineScheduleRow[] = []
  let openingBalance = roundCurrency(input.principal)
  const periodicInterest = roundCurrency(input.principal * rateDecimal)

  for (let index = 0; index < input.installmentCount; index++) {
    const isLast = index === input.installmentCount - 1
    const principalAmount = isLast ? openingBalance : 0
    const paymentAmount = roundCurrency(principalAmount + periodicInterest)
    const closingBalance = roundCurrency(Math.max(openingBalance - principalAmount, 0))

    schedule.push({
      installmentNumber: index + 1,
      dueDate: buildDueDate(input.startDate, input.paymentFrequency, index + 1, input.customFrequencyDays),
      openingBalance,
      paymentAmount,
      principalAmount,
      interestAmount: periodicInterest,
      closingBalance,
    })

    openingBalance = closingBalance
  }

  return {
    principal: roundCurrency(input.principal),
    interestMethod: 'INTEREST_ONLY',
    paymentFrequency: input.paymentFrequency,
    installmentCount: input.installmentCount,
    rateDecimal,
    interestPeriodCount: input.installmentCount,
    totalInterest: roundCurrency(schedule.reduce((sum, row) => sum + row.interestAmount, 0)),
    totalPayable: roundCurrency(schedule.reduce((sum, row) => sum + row.paymentAmount, 0)),
    periodicPayment: schedule[0]?.paymentAmount ?? 0,
    schedule,
  }
}

export function calculateLoanQuote(input: LoanEngineInput): LoanEngineResult {
  assertMoney(input.principal, 'principal')
  assertPositiveInteger(input.installmentCount, 'installmentCount')

  const rateDecimal = normalizeRate(input.rateValue, input.rateUnit ?? 'DECIMAL')
  const interestPeriodCount = input.interestPeriodCount ?? input.installmentCount

  if (input.interestMethod === 'FLAT_TOTAL') {
    const totalInterest = roundCurrency(input.principal * rateDecimal)
    return buildFlatSchedule(input, rateDecimal, 1, totalInterest)
  }

  if (input.interestMethod === 'FLAT_PER_PERIOD') {
    assertPositiveInteger(interestPeriodCount, 'interestPeriodCount')
    const totalInterest = roundCurrency(roundCurrency(input.principal * rateDecimal) * interestPeriodCount)
    return buildFlatSchedule(input, rateDecimal, interestPeriodCount, totalInterest)
  }

  if (input.interestMethod === 'ZERO_INTEREST') {
    return buildZeroInterestSchedule(input, 0)
  }

  if (input.interestMethod === 'INTEREST_ONLY') {
    return buildInterestOnlySchedule(input, rateDecimal)
  }

  return buildDecliningBalanceSchedule(input, rateDecimal)
}

export function inferLegacyInterestMethod(loanType: string | undefined, rawInterestMethod?: string | null): InterestMethod {
  const explicit = String(rawInterestMethod ?? '').toUpperCase().trim()
  const valid: InterestMethod[] = ['FLAT_TOTAL', 'FLAT_PER_PERIOD', 'DECLINING_BALANCE', 'INTEREST_ONLY', 'ZERO_INTEREST']
  if (valid.includes(explicit as InterestMethod)) return explicit as InterestMethod

  const normalizedLoanType = String(loanType ?? '').toLowerCase().trim()
  if (normalizedLoanType === 'carrito' || normalizedLoanType === 'flat' || normalizedLoanType === 'flat_rate') return 'FLAT_TOTAL'
  if (normalizedLoanType === 'weekly' || normalizedLoanType === 'amortized') return 'DECLINING_BALANCE'
  return 'DECLINING_BALANCE'
}

export function inferLegacyPaymentFrequency(loanType: string | undefined, rawFrequency?: string | null): PaymentFrequency {
  const explicit = String(rawFrequency ?? '').toUpperCase().trim()
  const valid: PaymentFrequency[] = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM']
  if (valid.includes(explicit as PaymentFrequency)) return explicit as PaymentFrequency

  const normalizedFrequency = String(rawFrequency ?? '').toLowerCase().trim()
  if (normalizedFrequency === 'daily') return 'DAILY'
  if (normalizedFrequency === 'weekly') return 'WEEKLY'
  if (normalizedFrequency === 'biweekly') return 'BIWEEKLY'
  if (normalizedFrequency === 'monthly') return 'MONTHLY'

  const normalizedLoanType = String(loanType ?? '').toLowerCase().trim()
  if (normalizedLoanType === 'weekly') return 'WEEKLY'
  if (normalizedLoanType === 'carrito') return normalizedFrequency === 'daily' ? 'DAILY' : 'WEEKLY'
  return 'MONTHLY'
}
