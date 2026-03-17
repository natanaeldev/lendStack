// ─── Restructure Simulation Engine ───────────────────────────────────────────
// PURE — no DB access, no side effects.
// Every function takes explicit inputs and returns a SimulationResult.
// Uses calculateLoanQuote from loanEngine for new schedule generation.

import { calculateLoanQuote } from '@/lib/loanEngine'
import type { InstallmentDoc } from '@/lib/loanDomain'
import type {
  CapitalizeArrearsInput,
  DueDateChangeInput,
  FullRestructureInput,
  GracePeriodInput,
  InstallmentChange,
  InstallmentSnapshot,
  InterestOnlyPeriodInput,
  LoanStateForSimulation,
  ModificationInput,
  RateReductionInput,
  ScheduleSummary,
  SimulationResult,
  TermExtensionInput,
} from './types'

// ─── Public entry point ───────────────────────────────────────────────────────

export function simulateModification(
  state: LoanStateForSimulation,
  input: ModificationInput,
): SimulationResult {
  switch (input.type) {
    case 'DUE_DATE_CHANGE':      return simulateDueDateChange(state, input)
    case 'TERM_EXTENSION':       return simulateTermExtension(state, input)
    case 'GRACE_PERIOD':         return simulateGracePeriod(state, input)
    case 'CAPITALIZE_ARREARS':   return simulateCapitalizeArrears(state, input)
    case 'RATE_REDUCTION':       return simulateRateReduction(state, input)
    case 'INTEREST_ONLY_PERIOD': return simulateInterestOnlyPeriod(state, input)
    case 'FULL_RESTRUCTURE':     return simulateFullRestructure(state, input)
  }
}

// ─── DUE_DATE_CHANGE ──────────────────────────────────────────────────────────
// No financial impact. Shifts dates only. Amounts unchanged.

function simulateDueDateChange(
  state: LoanStateForSimulation,
  input: DueDateChangeInput,
): SimulationResult {
  const before = buildSummary(state.unpaidInstallments, state.remainingBalance)
  const numberSet = new Set(input.installmentNumbers)
  const dateMap = new Map<number, string>(
    input.installmentNumbers.map((n, i) => [n, input.newDueDates[i]]),
  )

  const changes: InstallmentChange[] = []
  const newSchedule: InstallmentSnapshot[] = []

  for (const inst of state.unpaidInstallments) {
    const snap = toSnapshot(inst)
    if (numberSet.has(inst.installmentNumber)) {
      const newDate = dateMap.get(inst.installmentNumber)!
      const shifted: InstallmentSnapshot = { ...snap, dueDate: newDate }
      changes.push({ action: 'SHIFT_DATE', installmentNumber: inst.installmentNumber, before: snap, after: shifted })
      newSchedule.push(shifted)
    } else {
      changes.push({ action: 'KEEP', installmentNumber: inst.installmentNumber, before: snap, after: snap })
      newSchedule.push(snap)
    }
  }

  const after = buildSummaryFromSnapshots(newSchedule, state.remainingBalance)
  return buildResult('DUE_DATE_CHANGE', before, after, changes, newSchedule, state.remainingBalance, undefined)
}

// ─── TERM_EXTENSION ───────────────────────────────────────────────────────────
// Keeps remaining balance, extends count by N installments.
// Rate, method and frequency stay the same.

function simulateTermExtension(
  state: LoanStateForSimulation,
  input: TermExtensionInput,
): SimulationResult {
  const before = buildSummary(state.unpaidInstallments, state.remainingBalance)

  const newCount = state.unpaidInstallments.length + input.additionalInstallments
  const firstDueDate = state.unpaidInstallments[0]?.dueDate ?? state.today

  const engineResult = calculateLoanQuote({
    principal: state.remainingBalance,
    interestMethod: state.interestMethod,
    installmentCount: newCount,
    paymentFrequency: state.paymentFrequency,
    rateValue: state.rateValue,
    rateUnit: state.rateUnit,
    customFrequencyDays: state.customFrequencyDays,
    startDate: shiftOnePeriodBack(firstDueDate, state.paymentFrequency, state.customFrequencyDays),
  })

  const newSchedule = engineResult.schedule.map((row, i) => ({
    installmentNumber: (state.unpaidInstallments[0]?.installmentNumber ?? 1) + i,
    dueDate: row.dueDate,
    scheduledPrincipal: row.principalAmount,
    scheduledInterest: row.interestAmount,
    scheduledAmount: row.paymentAmount,
  }))

  const changes: InstallmentChange[] = buildSupersedePlusAdd(
    state.unpaidInstallments,
    newSchedule,
  )

  const after = buildSummaryFromSnapshots(newSchedule, state.remainingBalance)
  return buildResult('TERM_EXTENSION', before, after, changes, newSchedule, state.remainingBalance, engineResult.rateDecimal)
}

// ─── GRACE_PERIOD ─────────────────────────────────────────────────────────────
// Shifts due dates of all unpaid installments forward by gracePeriodCount periods.
// If capitalizeInterest: accrues interest for N periods, adds to principal, regenerates.

function simulateGracePeriod(
  state: LoanStateForSimulation,
  input: GracePeriodInput,
): SimulationResult {
  const before = buildSummary(state.unpaidInstallments, state.remainingBalance)

  if (!input.capitalizeInterest) {
    // Simple date shift: push every unpaid due date forward by N periods
    const newSchedule: InstallmentSnapshot[] = state.unpaidInstallments.map(inst => {
      const newDate = advanceDateByPeriods(
        inst.dueDate,
        state.paymentFrequency,
        input.gracePeriodCount,
        state.customFrequencyDays,
      )
      return { ...toSnapshot(inst), dueDate: newDate }
    })

    const changes: InstallmentChange[] = state.unpaidInstallments.map((inst, i) => ({
      action: 'SHIFT_DATE',
      installmentNumber: inst.installmentNumber,
      before: toSnapshot(inst),
      after: newSchedule[i],
    }))

    const after = buildSummaryFromSnapshots(newSchedule, state.remainingBalance)
    return buildResult('GRACE_PERIOD', before, after, changes, newSchedule, state.remainingBalance, undefined)
  }

  // With capitalization: accrue N periods of interest on remaining balance
  const periodicRate = state.rateUnit === 'PERCENT'
    ? state.rateValue / 100
    : state.rateValue
  const accruedInterest = roundMoney(state.remainingBalance * periodicRate * input.gracePeriodCount)
  const newPrincipal = roundMoney(state.remainingBalance + accruedInterest)

  const firstDueDate = state.unpaidInstallments[0]?.dueDate ?? state.today
  const shiftedFirstDate = advanceDateByPeriods(
    firstDueDate,
    state.paymentFrequency,
    input.gracePeriodCount,
    state.customFrequencyDays,
  )

  const engineResult = calculateLoanQuote({
    principal: newPrincipal,
    interestMethod: state.interestMethod,
    installmentCount: state.unpaidInstallments.length,
    paymentFrequency: state.paymentFrequency,
    rateValue: state.rateValue,
    rateUnit: state.rateUnit,
    customFrequencyDays: state.customFrequencyDays,
    startDate: shiftOnePeriodBack(shiftedFirstDate, state.paymentFrequency, state.customFrequencyDays),
  })

  const newSchedule = engineResult.schedule.map((row, i) => ({
    installmentNumber: (state.unpaidInstallments[0]?.installmentNumber ?? 1) + i,
    dueDate: row.dueDate,
    scheduledPrincipal: row.principalAmount,
    scheduledInterest: row.interestAmount,
    scheduledAmount: row.paymentAmount,
  }))

  const changes = buildSupersedePlusAdd(state.unpaidInstallments, newSchedule)
  const after = buildSummaryFromSnapshots(newSchedule, newPrincipal)
  return buildResult('GRACE_PERIOD', before, after, changes, newSchedule, newPrincipal, engineResult.rateDecimal)
}

// ─── CAPITALIZE_ARREARS ───────────────────────────────────────────────────────
// Adds overdue interest to outstanding principal, regenerates schedule.

function simulateCapitalizeArrears(
  state: LoanStateForSimulation,
  input: CapitalizeArrearsInput,
): SimulationResult {
  const before = buildSummary(state.unpaidInstallments, state.remainingBalance)

  const newPrincipal = roundMoney(state.remainingBalance + input.overdueInterest)
  const newCount = input.newInstallmentCount ?? state.unpaidInstallments.length
  const firstDueDate = state.unpaidInstallments[0]?.dueDate ?? state.today

  const engineResult = calculateLoanQuote({
    principal: newPrincipal,
    interestMethod: state.interestMethod,
    installmentCount: Math.max(newCount, 1),
    paymentFrequency: state.paymentFrequency,
    rateValue: state.rateValue,
    rateUnit: state.rateUnit,
    customFrequencyDays: state.customFrequencyDays,
    startDate: shiftOnePeriodBack(firstDueDate, state.paymentFrequency, state.customFrequencyDays),
  })

  const newSchedule = engineResult.schedule.map((row, i) => ({
    installmentNumber: (state.unpaidInstallments[0]?.installmentNumber ?? 1) + i,
    dueDate: row.dueDate,
    scheduledPrincipal: row.principalAmount,
    scheduledInterest: row.interestAmount,
    scheduledAmount: row.paymentAmount,
  }))

  const changes = buildSupersedePlusAdd(state.unpaidInstallments, newSchedule)
  const after = buildSummaryFromSnapshots(newSchedule, newPrincipal)
  return buildResult('CAPITALIZE_ARREARS', before, after, changes, newSchedule, newPrincipal, engineResult.rateDecimal)
}

// ─── RATE_REDUCTION ───────────────────────────────────────────────────────────
// Same remaining balance + count, new rate. Payment reduces.

function simulateRateReduction(
  state: LoanStateForSimulation,
  input: RateReductionInput,
): SimulationResult {
  const before = buildSummary(state.unpaidInstallments, state.remainingBalance)
  const firstDueDate = state.unpaidInstallments[0]?.dueDate ?? state.today

  const engineResult = calculateLoanQuote({
    principal: state.remainingBalance,
    interestMethod: state.interestMethod,
    installmentCount: Math.max(state.unpaidInstallments.length, 1),
    paymentFrequency: state.paymentFrequency,
    rateValue: input.newRateValue,
    rateUnit: input.newRateUnit,
    customFrequencyDays: state.customFrequencyDays,
    startDate: shiftOnePeriodBack(firstDueDate, state.paymentFrequency, state.customFrequencyDays),
  })

  const newSchedule = engineResult.schedule.map((row, i) => ({
    installmentNumber: (state.unpaidInstallments[0]?.installmentNumber ?? 1) + i,
    dueDate: row.dueDate,
    scheduledPrincipal: row.principalAmount,
    scheduledInterest: row.interestAmount,
    scheduledAmount: row.paymentAmount,
  }))

  const changes = buildSupersedePlusAdd(state.unpaidInstallments, newSchedule)
  const after = buildSummaryFromSnapshots(newSchedule, state.remainingBalance)
  return buildResult('RATE_REDUCTION', before, after, changes, newSchedule, state.remainingBalance, engineResult.rateDecimal)
}

// ─── INTEREST_ONLY_PERIOD ─────────────────────────────────────────────────────
// Insert N interest-only installments, then full amortization resumes for remainder.

function simulateInterestOnlyPeriod(
  state: LoanStateForSimulation,
  input: InterestOnlyPeriodInput,
): SimulationResult {
  const before = buildSummary(state.unpaidInstallments, state.remainingBalance)

  const periodicRate = state.rateUnit === 'PERCENT'
    ? state.rateValue / 100
    : state.rateValue

  const periodicInterest = roundMoney(state.remainingBalance * periodicRate)
  const firstDueDate = state.unpaidInstallments[0]?.dueDate ?? state.today
  const startInstNum = state.unpaidInstallments[0]?.installmentNumber ?? 1

  // Interest-only installments
  const interestOnlySnaps: InstallmentSnapshot[] = Array.from(
    { length: input.interestOnlyCount },
    (_, i) => ({
      installmentNumber: startInstNum + i,
      dueDate: advanceDateByPeriods(
        firstDueDate,
        state.paymentFrequency,
        i,
        state.customFrequencyDays,
      ),
      scheduledPrincipal: 0,
      scheduledInterest: periodicInterest,
      scheduledAmount: periodicInterest,
    }),
  )

  // Full amortization for the remaining installments after the I/O period
  const remainingCount = Math.max(state.unpaidInstallments.length - input.interestOnlyCount, 0)
  let amortSnaps: InstallmentSnapshot[] = []

  if (remainingCount > 0) {
    const resumeDate = advanceDateByPeriods(
      firstDueDate,
      state.paymentFrequency,
      input.interestOnlyCount,
      state.customFrequencyDays,
    )
    const engineResult = calculateLoanQuote({
      principal: state.remainingBalance,
      interestMethod: state.interestMethod,
      installmentCount: remainingCount,
      paymentFrequency: state.paymentFrequency,
      rateValue: state.rateValue,
      rateUnit: state.rateUnit,
      customFrequencyDays: state.customFrequencyDays,
      startDate: shiftOnePeriodBack(resumeDate, state.paymentFrequency, state.customFrequencyDays),
    })

    amortSnaps = engineResult.schedule.map((row, i) => ({
      installmentNumber: startInstNum + input.interestOnlyCount + i,
      dueDate: row.dueDate,
      scheduledPrincipal: row.principalAmount,
      scheduledInterest: row.interestAmount,
      scheduledAmount: row.paymentAmount,
    }))
  }

  const newSchedule = [...interestOnlySnaps, ...amortSnaps]
  const changes = buildSupersedePlusAdd(state.unpaidInstallments, newSchedule)
  const after = buildSummaryFromSnapshots(newSchedule, state.remainingBalance)
  return buildResult('INTEREST_ONLY_PERIOD', before, after, changes, newSchedule, state.remainingBalance, undefined)
}

// ─── FULL_RESTRUCTURE ─────────────────────────────────────────────────────────
// Complete replacement with caller-provided terms.

function simulateFullRestructure(
  state: LoanStateForSimulation,
  input: FullRestructureInput,
): SimulationResult {
  const before = buildSummary(state.unpaidInstallments, state.remainingBalance)

  const engineResult = calculateLoanQuote({
    principal: input.newPrincipal,
    interestMethod: input.newInterestMethod,
    installmentCount: input.newInstallmentCount,
    paymentFrequency: input.newPaymentFrequency,
    rateValue: input.newRateValue,
    rateUnit: input.newRateUnit,
    startDate: shiftOnePeriodBack(input.newStartDate, input.newPaymentFrequency, undefined),
  })

  const newSchedule: InstallmentSnapshot[] = engineResult.schedule.map((row, i) => ({
    installmentNumber: i + 1,
    dueDate: row.dueDate,
    scheduledPrincipal: row.principalAmount,
    scheduledInterest: row.interestAmount,
    scheduledAmount: row.paymentAmount,
  }))

  const changes = buildSupersedePlusAdd(state.unpaidInstallments, newSchedule)
  const after = buildSummaryFromSnapshots(newSchedule, input.newPrincipal)
  return buildResult('FULL_RESTRUCTURE', before, after, changes, newSchedule, input.newPrincipal, engineResult.rateDecimal)
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toSnapshot(inst: InstallmentDoc): InstallmentSnapshot {
  return {
    installmentNumber: inst.installmentNumber,
    dueDate: inst.dueDate,
    scheduledPrincipal: inst.scheduledPrincipal,
    scheduledInterest: inst.scheduledInterest,
    scheduledAmount: inst.scheduledAmount,
    status: inst.status,
    paidAmount: inst.paidAmount,
  }
}

function buildSummary(
  installments: InstallmentDoc[],
  remainingBalance: number,
): import('./types').ScheduleSummary {
  const totalInterest = sum(installments.map(i => i.scheduledInterest - (i.paidInterest ?? 0)))
  const totalPayable = sum(installments.map(i => i.scheduledAmount - (i.paidAmount ?? 0)))
  const sorted = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber)
  return {
    remainingInstallments: installments.length,
    remainingPrincipal: remainingBalance,
    totalRemainingInterest: roundMoney(totalInterest),
    totalRemainingPayable: roundMoney(totalPayable),
    periodicPayment: sorted[0]?.scheduledAmount ?? 0,
    firstDueDate: sorted[0]?.dueDate ?? null,
    lastDueDate: sorted[sorted.length - 1]?.dueDate ?? null,
  }
}

function buildSummaryFromSnapshots(
  snaps: InstallmentSnapshot[],
  remainingPrincipal: number,
): import('./types').ScheduleSummary {
  const sorted = [...snaps].sort((a, b) => a.installmentNumber - b.installmentNumber)
  return {
    remainingInstallments: snaps.length,
    remainingPrincipal,
    totalRemainingInterest: roundMoney(sum(snaps.map(s => s.scheduledInterest))),
    totalRemainingPayable: roundMoney(sum(snaps.map(s => s.scheduledAmount))),
    periodicPayment: sorted[0]?.scheduledAmount ?? 0,
    firstDueDate: sorted[0]?.dueDate ?? null,
    lastDueDate: sorted[sorted.length - 1]?.dueDate ?? null,
  }
}

/**
 * Produce SUPERSEDE entries for each existing unpaid installment,
 * and ADD entries for each new installment beyond the existing count.
 */
function buildSupersedePlusAdd(
  existing: InstallmentDoc[],
  newSchedule: InstallmentSnapshot[],
): InstallmentChange[] {
  const changes: InstallmentChange[] = []
  const maxExisting = existing.length
  const maxNew = newSchedule.length

  for (let i = 0; i < Math.max(maxExisting, maxNew); i++) {
    const old = existing[i] ? toSnapshot(existing[i]) : null
    const neu = newSchedule[i] ?? null
    if (old && neu) {
      changes.push({ action: 'SUPERSEDE', installmentNumber: old.installmentNumber, before: old, after: neu })
    } else if (!old && neu) {
      changes.push({ action: 'ADD', installmentNumber: neu.installmentNumber, before: null, after: neu })
    } else if (old && !neu) {
      changes.push({ action: 'SUPERSEDE', installmentNumber: old.installmentNumber, before: old, after: null })
    }
  }
  return changes
}

function buildResult(
  type: import('./types').ModificationType,
  before: import('./types').ScheduleSummary,
  after: import('./types').ScheduleSummary,
  changes: InstallmentChange[],
  newSchedule: InstallmentSnapshot[],
  newPrincipal: number,
  newRateDecimal: number | undefined,
): SimulationResult {
  return {
    type,
    before,
    after,
    changes,
    newSchedule,
    newPrincipal,
    newRateDecimal,
    impact: {
      deltaInstallments:      after.remainingInstallments - before.remainingInstallments,
      deltaTotalPayable:      roundMoney(after.totalRemainingPayable - before.totalRemainingPayable),
      deltaTotalInterest:     roundMoney(after.totalRemainingInterest - before.totalRemainingInterest),
      deltaPeriodicPayment:   roundMoney(after.periodicPayment - before.periodicPayment),
      deltaRemainingPrincipal: roundMoney(after.remainingPrincipal - before.remainingPrincipal),
      newFirstDueDate: after.firstDueDate,
      newLastDueDate:  after.lastDueDate,
    },
    simulatedAt: new Date().toISOString(),
  }
}

function roundMoney(v: number): number {
  return Math.round(v * 100) / 100
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}

/**
 * Advance an ISO date by `count` payment periods.
 */
export function advanceDateByPeriods(
  isoDate: string,
  freq: import('@/lib/loanEngine').PaymentFrequency,
  count: number,
  customFrequencyDays?: number,
): string {
  const d = new Date(`${isoDate}T12:00:00`)
  switch (freq) {
    case 'DAILY':    d.setDate(d.getDate() + count); break
    case 'WEEKLY':   d.setDate(d.getDate() + count * 7); break
    case 'BIWEEKLY': d.setDate(d.getDate() + count * 14); break
    case 'MONTHLY':  d.setMonth(d.getMonth() + count); break
    case 'CUSTOM':   d.setDate(d.getDate() + count * Math.max(customFrequencyDays ?? 1, 1)); break
  }
  return d.toISOString().slice(0, 10)
}

/**
 * loanEngine.calculateLoanQuote generates due dates as startDate + 1 period, +2 periods, …
 * So to make the first installment land on `firstDueDate`, we need to pass `firstDueDate - 1 period`.
 */
function shiftOnePeriodBack(
  firstDueDate: string,
  freq: import('@/lib/loanEngine').PaymentFrequency,
  customFrequencyDays?: number,
): string {
  return advanceDateByPeriods(firstDueDate, freq, -1, customFrequencyDays)
}
