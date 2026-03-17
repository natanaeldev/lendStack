// ─── Installment Engine ───────────────────────────────────────────────────────
// Generates persisted InstallmentDoc[] from loan terms using the existing
// loan.ts calculation functions. Call this when a loan is disbursed.

import { v4 as uuidv4 } from 'uuid'
import {
  calculateLoanQuote,
  inferLegacyInterestMethod,
  inferLegacyPaymentFrequency,
} from './loan'
import type { InstallmentDoc, LoanDoc } from './loanDomain'

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function sumMoney(values: number[]) {
  return roundMoney(values.reduce((sum, value) => sum + value, 0))
}

// ─── Main Generator ───────────────────────────────────────────────────────────

/**
 * Generates the full installment schedule for a loan.
 * Should be called at disbursement time.
 *
 * Returns an array of InstallmentDoc (without _id populated — caller adds them).
 */
export function generateInstallments(
  loan: LoanDoc,
  organizationId: string,
): InstallmentDoc[] {
  const startDate = loan.disbursedAt
    ? new Date(loan.disbursedAt)
    : new Date()

  const installments: InstallmentDoc[] = []

  const paymentFrequency = inferLegacyPaymentFrequency(loan.loanType, loan.paymentFrequency ?? loan.carritoFrequency)
  const interestMethod = inferLegacyInterestMethod(loan.loanType, loan.interestMethod)
  const installmentCount =
    loan.installmentCount ??
    (loan.loanType === 'amortized'
      ? Math.max(1, loan.totalMonths ?? Math.round((loan.termYears ?? 1) * 12))
      : loan.loanType === 'weekly'
        ? Math.max(1, loan.totalWeeks ?? loan.termWeeks ?? 1)
        : Math.max(1, loan.carritoPayments ?? 1))

  const rateValue =
    loan.rateValue ??
    (interestMethod === 'DECLINING_BALANCE'
      ? paymentFrequency === 'WEEKLY'
        ? loan.weeklyRate ?? ((loan.customMonthlyRate ?? loan.monthlyRate ?? 0) / 4.33)
        : loan.monthlyRate ?? loan.customMonthlyRate ?? 0
      : loan.customMonthlyRate ?? 0)

  const quote = calculateLoanQuote({
    principal: loan.totalFinancedAmount ?? loan.amount,
    interestMethod,
    installmentCount,
    paymentFrequency,
    rateValue,
    rateUnit: loan.rateUnit ?? 'DECIMAL',
    interestPeriodCount: loan.interestPeriodCount ?? (interestMethod === 'FLAT_PER_PERIOD' ? loan.carritoTerm ?? installmentCount : 1),
    startDate: startDate.toISOString().slice(0, 10),
  })

  for (const row of quote.schedule) {
    const label =
      paymentFrequency === 'DAILY'
        ? `Día ${row.installmentNumber}`
        : paymentFrequency === 'WEEKLY'
          ? `Semana ${row.installmentNumber}`
          : paymentFrequency === 'BIWEEKLY'
            ? `Quincena ${row.installmentNumber}`
            : `Cuota ${row.installmentNumber}`

    installments.push({
      _id: uuidv4(),
      organizationId,
      loanId: loan._id,
      clientId: loan.clientId,
      installmentNumber: row.installmentNumber,
      dueDate: row.dueDate,
      periodLabel: label,
      scheduledPrincipal: row.principalAmount,
      scheduledInterest: row.interestAmount,
      scheduledAmount: row.paymentAmount,
      paidPrincipal: 0,
      paidInterest: 0,
      paidAmount: 0,
      remainingAmount: row.paymentAmount,
      status: 'pending',
    })
  }

  return installments
}

export function computeOutstandingAmount(installments: Pick<InstallmentDoc, 'remainingAmount'>[]) {
  return roundMoney(sumMoney(installments.map((installment) => installment.remainingAmount)))
}

export function computeLoanContractBalance(
  loan: Pick<LoanDoc, 'totalPayment' | 'paidTotal' | 'remainingBalance'>,
  installments: Pick<InstallmentDoc, 'remainingAmount'>[] = [],
) {
  if (installments.length > 0) {
    return computeOutstandingAmount(installments)
  }

  return roundMoney(Math.max((loan.totalPayment ?? loan.remainingBalance ?? 0) - (loan.paidTotal ?? 0), 0))
}

// ─── Delinquency Snapshot ─────────────────────────────────────────────────────

export interface DelinquencySnapshot {
  daysPastDue:              number
  overdueInstallmentsCount: number
  overdueAmount:            number
  isDelinquent:             boolean
}

export function computeDelinquency(
  installments: InstallmentDoc[],
  asOf: Date = new Date(),
): DelinquencySnapshot {
  const today = asOf.toISOString().slice(0, 10)
  const overdue = installments.filter(
    i => i.dueDate < today && i.remainingAmount > 0,
  )
  if (overdue.length === 0) {
    return { daysPastDue: 0, overdueInstallmentsCount: 0, overdueAmount: 0, isDelinquent: false }
  }
  const oldest   = overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  const msPerDay = 86_400_000
  const dpd      = Math.floor((asOf.getTime() - new Date(oldest.dueDate).getTime()) / msPerDay)
  const overdueAmount = overdue.reduce((s, i) => s + i.remainingAmount, 0)
  return {
    daysPastDue:              Math.max(dpd, 0),
    overdueInstallmentsCount: overdue.length,
    overdueAmount,
    isDelinquent:             true,
  }
}

// ─── Payment Application ──────────────────────────────────────────────────────

export interface PaymentApplication {
  applied:              { installmentId: string; amount: number; principal: number; interest: number }[]
  totalApplied:         number
  overpayment:          number
  updatedInstallments:  InstallmentDoc[]
}

/**
 * Applies a payment amount to installments, oldest-due first.
 * Mutates nothing — returns a new array of updated installments.
 * Overpayment is returned separately; caller decides how to handle it.
 */
export function applyPayment(
  installments: InstallmentDoc[],
  paymentAmount: number,
  targetInstallmentId?: string,   // if set, apply to this specific one first
): PaymentApplication {
  if (paymentAmount <= 0) {
    return { applied: [], totalApplied: 0, overpayment: 0, updatedInstallments: [...installments] }
  }

  // Work on a deep copy
  const working: InstallmentDoc[] = installments.map(i => ({ ...i }))

  // Sort: if a specific target is given, put it first; then oldest due-date first
  const unpaid = working
    .filter(i => i.remainingAmount > 0)
    .sort((a, b) => {
      if (targetInstallmentId) {
        if (a._id === targetInstallmentId) return -1
        if (b._id === targetInstallmentId) return  1
      }
      return a.dueDate.localeCompare(b.dueDate)
    })

  let remaining = paymentAmount
  const applied: PaymentApplication['applied'] = []

  for (const inst of unpaid) {
    if (remaining <= 0) break
    const toApply   = Math.min(remaining, inst.remainingAmount)
    // Proportionally split between interest and principal
    const ratio     = inst.scheduledAmount > 0 ? toApply / inst.scheduledAmount : 0
    const appInt    = Math.min(toApply, inst.scheduledInterest  - inst.paidInterest)
    const appPrin   = toApply - appInt

    // Find the working copy
    const widx = working.findIndex(i => i._id === inst._id)
    if (widx === -1) continue

    working[widx] = {
      ...working[widx],
      paidAmount:     working[widx].paidAmount    + toApply,
      paidInterest:   working[widx].paidInterest  + appInt,
      paidPrincipal:  working[widx].paidPrincipal + appPrin,
      remainingAmount: Math.max(working[widx].remainingAmount - toApply, 0),
      status: working[widx].remainingAmount - toApply <= 0.005
        ? 'paid'
        : (working[widx].paidAmount + toApply > 0 ? 'partial' : working[widx].status),
      paidAt: working[widx].remainingAmount - toApply <= 0.005
        ? new Date().toISOString()
        : undefined,
    }

    applied.push({ installmentId: inst._id, amount: toApply, principal: appPrin, interest: appInt })
    remaining -= toApply
  }

  // Re-stamp overdue status for today
  const today = new Date().toISOString().slice(0, 10)
  for (let i = 0; i < working.length; i++) {
    if (working[i].remainingAmount > 0 && working[i].dueDate < today) {
      working[i] = { ...working[i], status: 'overdue' }
    }
  }

  return {
    applied,
    totalApplied:        paymentAmount - remaining,
    overpayment:         remaining,
    updatedInstallments: working,
  }
}
