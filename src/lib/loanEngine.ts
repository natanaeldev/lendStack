export type InterestMethod =
  | 'FLAT_TOTAL'
  | 'FLAT_PER_PERIOD'
  | 'DECLINING_BALANCE'
  | 'INTEREST_ONLY'
  | 'ZERO_INTEREST'

export type PaymentFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM'
export type RateUnit = 'PERCENT' | 'DECIMAL'
export type TermUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS'
export type ScheduleGenerationMethod =
  | 'EQUAL_INSTALLMENT_LAST_ADJUSTMENT'
  | 'DECLINING_BALANCE_LAST_PAYMENT_ADJUSTMENT'
  | 'INTEREST_ONLY_BALLOON'
  | 'ZERO_INTEREST_LAST_ADJUSTMENT'

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
  scheduleGenerationMethod: ScheduleGenerationMethod
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

function requiresExplicitRate(method: InterestMethod) {
  return method !== 'ZERO_INTEREST'
}

function toCents(value: number) {
  return Math.round(value * 100)
}

function fromCents(value: number) {
  return value / 100
}

function roundMoney(value: number) {
  return fromCents(toCents(value))
}

function sumMoney(values: number[]) {
  return roundMoney(values.reduce((sum, value) => sum + value, 0))
}

function allocateRoundedInstallments(total: number, count: number) {
  if (count === 1) return [roundMoney(total)]

  const roundedBase = roundMoney(total / count)
  const installments = Array.from({ length: count }, () => roundedBase)
  installments[count - 1] = roundMoney(total - roundMoney(roundedBase * (count - 1)))
  return installments
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
  const totalPayable = roundMoney(input.principal + totalInterest)
  const paymentParts = allocateRoundedInstallments(totalPayable, input.installmentCount)
  const principalParts = allocateRoundedInstallments(input.principal, input.installmentCount)
  const schedule: LoanEngineScheduleRow[] = []
  let openingBalance = roundMoney(input.principal)

  for (let index = 0; index < input.installmentCount; index++) {
    const paymentAmount = paymentParts[index]
    const principalAmount = principalParts[index]
    const interestAmount = roundMoney(paymentAmount - principalAmount)
    const closingBalance = roundMoney(Math.max(openingBalance - principalAmount, 0))

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
    principal: roundMoney(input.principal),
    interestMethod: input.interestMethod,
    paymentFrequency: input.paymentFrequency,
    installmentCount: input.installmentCount,
    scheduleGenerationMethod: 'EQUAL_INSTALLMENT_LAST_ADJUSTMENT',
    rateDecimal,
    interestPeriodCount,
    totalInterest: sumMoney(schedule.map((row) => row.interestAmount)),
    totalPayable: sumMoney(schedule.map((row) => row.paymentAmount)),
    periodicPayment: schedule[0]?.paymentAmount ?? 0,
    schedule,
  }
}

function buildZeroInterestSchedule(input: LoanEngineInput, rateDecimal: number): LoanEngineResult {
  const principalParts = allocateRoundedInstallments(input.principal, input.installmentCount)
  const schedule: LoanEngineScheduleRow[] = []
  let openingBalance = roundMoney(input.principal)

  for (let index = 0; index < input.installmentCount; index++) {
    const principalAmount = principalParts[index]
    const closingBalance = roundMoney(Math.max(openingBalance - principalAmount, 0))

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
    principal: roundMoney(input.principal),
    interestMethod: 'ZERO_INTEREST',
    paymentFrequency: input.paymentFrequency,
    installmentCount: input.installmentCount,
    scheduleGenerationMethod: 'ZERO_INTEREST_LAST_ADJUSTMENT',
    rateDecimal,
    interestPeriodCount: input.installmentCount,
    totalInterest: 0,
    totalPayable: sumMoney(schedule.map((row) => row.paymentAmount)),
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
  const standardPayment = roundMoney(periodicPaymentRaw)
  let openingBalance = roundMoney(input.principal)

  for (let index = 0; index < input.installmentCount; index++) {
    const interestAmount = roundMoney(openingBalance * rateDecimal)
    const isLast = index === input.installmentCount - 1
    const principalAmount = isLast ? openingBalance : roundMoney(Math.min(standardPayment - interestAmount, openingBalance))
    const paymentAmount = roundMoney(principalAmount + interestAmount)
    const closingBalance = roundMoney(Math.max(openingBalance - principalAmount, 0))

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
    principal: roundMoney(input.principal),
    interestMethod: 'DECLINING_BALANCE',
    paymentFrequency: input.paymentFrequency,
    installmentCount: input.installmentCount,
    scheduleGenerationMethod: 'DECLINING_BALANCE_LAST_PAYMENT_ADJUSTMENT',
    rateDecimal,
    interestPeriodCount: input.installmentCount,
    totalInterest: sumMoney(schedule.map((row) => row.interestAmount)),
    totalPayable: sumMoney(schedule.map((row) => row.paymentAmount)),
    periodicPayment: schedule[0]?.paymentAmount ?? 0,
    schedule,
  }
}

function buildInterestOnlySchedule(input: LoanEngineInput, rateDecimal: number): LoanEngineResult {
  const schedule: LoanEngineScheduleRow[] = []
  let openingBalance = roundMoney(input.principal)
  const periodicInterest = roundMoney(input.principal * rateDecimal)

  for (let index = 0; index < input.installmentCount; index++) {
    const isLast = index === input.installmentCount - 1
    const principalAmount = isLast ? openingBalance : 0
    const paymentAmount = roundMoney(principalAmount + periodicInterest)
    const closingBalance = roundMoney(Math.max(openingBalance - principalAmount, 0))

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
    principal: roundMoney(input.principal),
    interestMethod: 'INTEREST_ONLY',
    paymentFrequency: input.paymentFrequency,
    installmentCount: input.installmentCount,
    scheduleGenerationMethod: 'INTEREST_ONLY_BALLOON',
    rateDecimal,
    interestPeriodCount: input.installmentCount,
    totalInterest: sumMoney(schedule.map((row) => row.interestAmount)),
    totalPayable: sumMoney(schedule.map((row) => row.paymentAmount)),
    periodicPayment: schedule[0]?.paymentAmount ?? 0,
    schedule,
  }
}

export function calculateLoanQuote(input: LoanEngineInput): LoanEngineResult {
  assertMoney(input.principal, 'principal')
  assertPositiveInteger(input.installmentCount, 'installmentCount')
  if (requiresExplicitRate(input.interestMethod) && input.rateValue === undefined) {
    throw new Error(`rateValue is required for ${input.interestMethod}.`)
  }
  if (input.paymentFrequency === 'CUSTOM' && (!Number.isInteger(input.customFrequencyDays) || (input.customFrequencyDays ?? 0) < 1)) {
    throw new Error('customFrequencyDays is required and must be a positive integer when paymentFrequency is CUSTOM.')
  }

  const rateDecimal = normalizeRate(input.rateValue, input.rateUnit ?? 'DECIMAL')
  const interestPeriodCount = input.interestPeriodCount ?? input.installmentCount

  if (input.interestMethod === 'FLAT_TOTAL') {
    const totalInterest = roundMoney(input.principal * rateDecimal)
    return buildFlatSchedule(input, rateDecimal, 1, totalInterest)
  }

  if (input.interestMethod === 'FLAT_PER_PERIOD') {
    assertPositiveInteger(interestPeriodCount, 'interestPeriodCount')
    const totalInterest = roundMoney(input.principal * rateDecimal * interestPeriodCount)
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
