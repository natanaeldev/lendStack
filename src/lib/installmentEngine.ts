// ─── Installment Engine ───────────────────────────────────────────────────────
// Generates persisted InstallmentDoc[] from loan terms using the existing
// loan.ts calculation functions. Call this when a loan is disbursed.

import { v4 as uuidv4 } from 'uuid'
import {
  buildAmortization,
  buildWeeklySchedule,
  buildCarritoSchedule,
  type LoanParams,
  type RiskProfile,
} from './loan'
import type { InstallmentDoc, LoanDoc } from './loanDomain'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
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

  // ── Amortized ───────────────────────────────────────────────────────────────
  if (loan.loanType === 'amortized') {
    const params: LoanParams = {
      amount:            loan.amount,
      termYears:         loan.termYears ?? 1,
      profile:           (loan.profile ?? 'Medium Risk') as RiskProfile,
      currency:          loan.currency,
      rateMode:          (loan.rateMode ?? 'annual') as any,
      customMonthlyRate: loan.customMonthlyRate ?? 0,
      startDate:         startDate.toISOString().slice(0, 10),
    }
    const rows = buildAmortization(params)
    for (const row of rows) {
      const dueDate = addMonths(startDate, row.month)
      const scheduled = row.payment
      installments.push({
        _id:            uuidv4(),
        organizationId,
        loanId:         loan._id,
        clientId:       loan.clientId,
        installmentNumber: row.month,
        dueDate:        dueDate.toISOString().slice(0, 10),
        periodLabel:    `Cuota ${row.month}`,
        scheduledPrincipal: row.principal,
        scheduledInterest:  row.interest,
        scheduledAmount:    scheduled,
        paidPrincipal:  0,
        paidInterest:   0,
        paidAmount:     0,
        remainingAmount: scheduled,
        status:         'pending',
      })
    }
    return installments
  }

  // ── Weekly ──────────────────────────────────────────────────────────────────
  if (loan.loanType === 'weekly') {
    const rows = buildWeeklySchedule(
      loan.amount,
      loan.termWeeks ?? 52,
      loan.customMonthlyRate ?? (loan.monthlyRate ?? 0.05),
      startDate,
    )
    for (const row of rows) {
      const scheduled = row.payment
      installments.push({
        _id:            uuidv4(),
        organizationId,
        loanId:         loan._id,
        clientId:       loan.clientId,
        installmentNumber: row.period,
        dueDate:        row.dueDate,
        periodLabel:    `Semana ${row.period}`,
        scheduledPrincipal: row.principal,
        scheduledInterest:  row.interest,
        scheduledAmount:    scheduled,
        paidPrincipal:  0,
        paidInterest:   0,
        paidAmount:     0,
        remainingAmount: scheduled,
        status:         'pending',
      })
    }
    return installments
  }

  // ── Carrito ─────────────────────────────────────────────────────────────────
  if (loan.loanType === 'carrito') {
    const freq = loan.carritoFrequency ?? 'weekly'
    const rows = buildCarritoSchedule(
      loan.amount,
      loan.customMonthlyRate ?? 0.20,   // carritoFlatRate stored in customMonthlyRate
      loan.carritoTerm ?? 4,
      loan.carritoPayments ?? 4,
      freq,
      startDate,
    )
    for (const row of rows) {
      const scheduled = row.payment
      const label = freq === 'daily' ? `Día ${row.period}` : `Semana ${row.period}`
      installments.push({
        _id:            uuidv4(),
        organizationId,
        loanId:         loan._id,
        clientId:       loan.clientId,
        installmentNumber: row.period,
        dueDate:        row.dueDate,
        periodLabel:    label,
        scheduledPrincipal: row.principal,
        scheduledInterest:  row.interest,
        scheduledAmount:    scheduled,
        paidPrincipal:  0,
        paidInterest:   0,
        paidAmount:     0,
        remainingAmount: scheduled,
        status:         'pending',
      })
    }
    return installments
  }

  return installments
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
