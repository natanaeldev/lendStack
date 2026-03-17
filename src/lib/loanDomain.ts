// ─── LendStack Domain Types ───────────────────────────────────────────────────
// This file defines the canonical domain model for the lending lifecycle.
// The `clients` collection remains the borrower record.
// The `loans` collection is the operational loan record.
// `installments`, `payments`, and `collection_actions` are child collections.

import type { Currency, InterestMethod, PaymentFrequency, RateUnit, ScheduleGenerationMethod } from './loan'

export type LoanChargeType = 'origination_cost' | 'gastos_procesales'

// ─── Loan Lifecycle ───────────────────────────────────────────────────────────

/**
 * Full loan lifecycle state machine.
 *
 * Migration map for old loanStatus values on clients collection:
 *   'pending'  → 'application_submitted'
 *   'approved' → 'approved'
 *   'denied'   → 'denied'
 */
export type LoanStatus =
  | 'application_submitted'
  | 'under_review'
  | 'approved'
  | 'denied'
  | 'disbursed'
  | 'active'
  | 'delinquent'
  | 'paid_off'
  | 'defaulted'
  | 'cancelled'

/** Map legacy 3-state values to the full lifecycle */
export function migrateLegacyStatus(raw: string | undefined): LoanStatus {
  if (!raw || raw === 'pending') return 'application_submitted'
  if (raw === 'approved') return 'approved'
  if (raw === 'denied') return 'denied'
  // Already a full lifecycle status
  const valid: LoanStatus[] = [
    'application_submitted', 'under_review', 'approved', 'denied',
    'disbursed', 'active', 'delinquent', 'paid_off', 'defaulted', 'cancelled',
  ]
  return valid.includes(raw as LoanStatus) ? (raw as LoanStatus) : 'application_submitted'
}

/** Returns the legacy 3-value status for backward compat with old UI */
export function toLegacyStatus(status: LoanStatus): 'pending' | 'approved' | 'denied' {
  if (status === 'denied') return 'denied'
  if (['approved', 'disbursed', 'active', 'delinquent', 'paid_off'].includes(status)) return 'approved'
  return 'pending'
}

export const LOAN_STATUS_CONFIG: Record<LoanStatus, {
  label: string; color: string; bg: string; border: string; dot: string
}> = {
  application_submitted: { label: 'Enviada',       color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  under_review:          { label: 'En revisión',   color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6' },
  approved:              { label: 'Aprobado',      color: '#14532D', bg: '#F0FDF4', border: '#86EFAC', dot: '#16A34A' },
  denied:                { label: 'Denegado',      color: '#881337', bg: '#FFF1F2', border: '#FECDD3', dot: '#DC2626' },
  disbursed:             { label: 'Desembolsado',  color: '#1E3A5F', bg: '#EFF6FF', border: '#93C5FD', dot: '#2563EB' },
  active:                { label: 'Activo',        color: '#064E3B', bg: '#ECFDF5', border: '#6EE7B7', dot: '#10B981' },
  delinquent:            { label: 'Moroso',        color: '#7C2D12', bg: '#FFF7ED', border: '#FDBA74', dot: '#F97316' },
  paid_off:              { label: 'Pagado',        color: '#1E3A5F', bg: '#F0F9FF', border: '#BAE6FD', dot: '#0284C7' },
  defaulted:             { label: 'En default',    color: '#450A0A', bg: '#FEF2F2', border: '#FCA5A5', dot: '#B91C1C' },
  cancelled:             { label: 'Cancelado',     color: '#374151', bg: '#F9FAFB', border: '#E5E7EB', dot: '#6B7280' },
}

// ─── Loan (loans collection) ──────────────────────────────────────────────────

export interface LoanDoc {
  _id:            string   // uuid
  organizationId: string
  clientId:       string   // reference to clients._id

  // Lifecycle
  status:    LoanStatus
  createdAt: string   // ISO
  updatedAt: string   // ISO

  // Loan terms (mirrors what was in clients.loan)
  loanType:          'amortized' | 'weekly' | 'carrito'
  currency:          Currency
  amount:            number
  totalFinancedAmount?: number
  netDisbursedAmount?: number
  termYears?:        number    // amortized
  termWeeks?:        number    // weekly
  carritoTerm?:      number    // carrito
  carritoPayments?:  number    // carrito
  carritoFrequency?: 'daily' | 'weekly'
  profile?:          string    // risk profile for amortized
  rateMode?:         string
  customMonthlyRate?: number
  interestMethod?:   InterestMethod
  paymentFrequency?: PaymentFrequency
  installmentCount?: number
  interestPeriodCount?: number
  rateValue?:        number
  rateUnit?:         RateUnit
  scheduleGenerationMethod?: ScheduleGenerationMethod
  annualRate?:       number
  monthlyRate?:      number
  weeklyRate?:       number
  totalMonths?:      number
  totalWeeks?:       number
  scheduledPayment:  number    // monthly/weekly/per-period payment
  totalPayment:      number
  totalInterest:     number
  startDate?:        string    // disbursement date

  // Disbursement
  disbursedAt?:     string
  disbursedAmount?: number
  disbursedBy?:     string   // userId
  disbursementNotes?: string

  // Running totals (updated on each payment post)
  paidPrincipal:  number   // default 0
  paidInterest:   number   // default 0
  paidTotal:      number   // default 0
  remainingBalance: number  // contractual outstanding amount remaining

  // Delinquency snapshot (updated by delinquency job or on-demand)
  daysPastDue?:              number
  overdueInstallmentsCount?: number
  overdueAmount?:            number

  // Notes
  notes?: string
}

export interface LoanChargeDoc {
  _id:            string
  organizationId: string
  loanId:         string
  type:           LoanChargeType
  label:          string
  amount:         number
  financed:       boolean
  createdAt:      string
  updatedAt:      string
}

// ─── Installment (installments collection) ────────────────────────────────────

export type InstallmentStatus = 'pending' | 'partial' | 'paid' | 'overdue'

export interface InstallmentDoc {
  _id:            string   // uuid
  organizationId: string
  loanId:         string   // reference to loans._id
  clientId:       string

  installmentNumber: number
  dueDate:           string   // ISO date YYYY-MM-DD
  periodLabel?:      string   // e.g. "Semana 1", "Cuota 3"

  scheduledPrincipal: number
  scheduledInterest:  number
  scheduledAmount:    number

  paidPrincipal:  number   // default 0
  paidInterest:   number   // default 0
  paidAmount:     number   // default 0
  remainingAmount: number   // scheduledAmount - paidAmount

  status:  InstallmentStatus
  paidAt?: string   // ISO when fully paid
}

// ─── Payment (payments collection) ───────────────────────────────────────────

export interface PaymentDoc {
  _id:            string
  organizationId: string
  loanId:         string
  clientId:       string

  date:   string   // ISO date — when payment occurred
  amount: number

  appliedPrincipal: number
  appliedInterest:  number

  // Installments touched by this payment
  installmentsAffected: { installmentId: string; amount: number }[]

  notes?:        string
  registeredAt:  string   // ISO — when posted
  registeredBy?: string   // userId
}

// ─── Collection Action (collection_actions collection) ───────────────────────

export type CollectionActionType =
  | 'call'
  | 'whatsapp'
  | 'visit'
  | 'promise_to_pay'
  | 'email'
  | 'other'

export const COLLECTION_ACTION_LABELS: Record<CollectionActionType, string> = {
  call:            'Llamada',
  whatsapp:        'WhatsApp',
  visit:           'Visita',
  promise_to_pay:  'Promesa de pago',
  email:           'Email',
  other:           'Otro',
}

export interface CollectionActionDoc {
  _id:            string
  organizationId: string
  loanId:         string
  clientId:       string

  date:       string   // ISO
  actionType: CollectionActionType
  note?:      string
  createdAt:  string
  createdBy?: string   // userId

  promisedPaymentDate?: string   // ISO
  promisedAmount?:      number
}
