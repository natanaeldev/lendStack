// ─── Loan Restructure & Reschedule — Domain Types ─────────────────────────────
// Non-negotiables:
//  · Original installment data is NEVER mutated — only superseded
//  · Every booking creates an immutable schedule snapshot
//  · Every workflow transition is recorded in modification_audit
//  · Simulation result is embedded in the modification record at creation time

import type {
  InterestMethod,
  PaymentFrequency,
  RateUnit,
} from '@/lib/loanEngine'
import type { InstallmentDoc } from '@/lib/loanDomain'

// ─── Modification type catalogue ─────────────────────────────────────────────

export type ModificationType =
  | 'DUE_DATE_CHANGE'       // Shift the due date of one or more installments
  | 'TERM_EXTENSION'        // Add N installments to the remaining schedule
  | 'GRACE_PERIOD'          // Suspend N payment periods (optionally capitalize interest)
  | 'CAPITALIZE_ARREARS'    // Roll overdue principal + interest into new balance
  | 'RATE_REDUCTION'        // Lower the interest rate going forward
  | 'INTEREST_ONLY_PERIOD'  // Convert next N installments to interest-only
  | 'FULL_RESTRUCTURE'      // Replace entire remaining schedule with new terms

// ─── Workflow state machine ───────────────────────────────────────────────────
//
//  DRAFT ──► PENDING_APPROVAL ──► APPROVED ──► BOOKED
//     └──► CANCELLED              └──► REJECTED
//
export type ModificationStatus =
  | 'DRAFT'            // Saved simulation, awaiting submitter action
  | 'PENDING_APPROVAL' // Submitted by maker, awaiting checker
  | 'APPROVED'         // Approved by checker, not yet applied to the loan
  | 'BOOKED'           // Applied — installments superseded, version created
  | 'REJECTED'         // Checker rejected
  | 'CANCELLED'        // Maker cancelled before approval

export const MODIFICATION_STATUS_LABELS: Record<ModificationStatus, string> = {
  DRAFT:            'Borrador',
  PENDING_APPROVAL: 'Pendiente de aprobación',
  APPROVED:         'Aprobado',
  BOOKED:           'Aplicado',
  REJECTED:         'Rechazado',
  CANCELLED:        'Cancelado',
}

export const MODIFICATION_TYPE_LABELS: Record<ModificationType, string> = {
  DUE_DATE_CHANGE:      'Cambio de fecha de vencimiento',
  TERM_EXTENSION:       'Extensión de plazo',
  GRACE_PERIOD:         'Período de gracia',
  CAPITALIZE_ARREARS:   'Capitalización de mora',
  RATE_REDUCTION:       'Reducción de tasa',
  INTEREST_ONLY_PERIOD: 'Período de solo interés',
  FULL_RESTRUCTURE:     'Reestructuración total',
}

// ─── Per-type modification inputs ────────────────────────────────────────────

export interface DueDateChangeInput {
  type: 'DUE_DATE_CHANGE'
  /** Installment numbers to shift (1-based, sorted ascending) */
  installmentNumbers: number[]
  /** New due dates aligned 1-to-1 with installmentNumbers */
  newDueDates: string[]       // ISO date YYYY-MM-DD
}

export interface TermExtensionInput {
  type: 'TERM_EXTENSION'
  additionalInstallments: number   // Must be >= 1
}

export interface GracePeriodInput {
  type: 'GRACE_PERIOD'
  gracePeriodCount: number         // How many periods to suspend
  capitalizeInterest: boolean      // true → accrue interest adds to principal
}

export interface CapitalizeArrearsInput {
  type: 'CAPITALIZE_ARREARS'
  /** Overdue interest amount to add to principal (caller confirms from delinquency data) */
  overdueInterest: number
  /**
   * Optional: replace the remaining installment count.
   * Defaults to the number of remaining unpaid installments.
   */
  newInstallmentCount?: number
}

export interface RateReductionInput {
  type: 'RATE_REDUCTION'
  newRateValue: number
  newRateUnit: RateUnit
}

export interface InterestOnlyPeriodInput {
  type: 'INTEREST_ONLY_PERIOD'
  interestOnlyCount: number        // How many interest-only periods to insert
}

export interface FullRestructureInput {
  type: 'FULL_RESTRUCTURE'
  /**
   * New principal. Typically = loan.remainingBalance ± capitalised items.
   * Caller must justify this in submissionReason.
   */
  newPrincipal: number
  newInterestMethod: InterestMethod
  newInstallmentCount: number
  newPaymentFrequency: PaymentFrequency
  newRateValue: number
  newRateUnit: RateUnit
  /** ISO date for the first new installment */
  newStartDate: string
}

export type ModificationInput =
  | DueDateChangeInput
  | TermExtensionInput
  | GracePeriodInput
  | CapitalizeArrearsInput
  | RateReductionInput
  | InterestOnlyPeriodInput
  | FullRestructureInput

// ─── Simulation types ─────────────────────────────────────────────────────────

export interface InstallmentSnapshot {
  installmentNumber: number
  dueDate: string
  scheduledPrincipal: number
  scheduledInterest: number
  scheduledAmount: number
  /** Kept from the source installment for context */
  status?: string
  paidAmount?: number
}

export interface ScheduleSummary {
  remainingInstallments: number
  remainingPrincipal: number
  totalRemainingInterest: number
  totalRemainingPayable: number
  periodicPayment: number
  firstDueDate: string | null
  lastDueDate: string | null
}

/** Per-installment level change descriptor */
export interface InstallmentChange {
  action: 'KEEP' | 'SUPERSEDE' | 'ADD' | 'SHIFT_DATE'
  installmentNumber: number
  before: InstallmentSnapshot | null
  after: InstallmentSnapshot | null
}

export interface LoanImpact {
  /** Positive = more installments added */
  deltaInstallments: number
  /** Positive = borrower will pay more total */
  deltaTotalPayable: number
  /** Positive = more interest */
  deltaTotalInterest: number
  /** Positive = higher periodic payment */
  deltaPeriodicPayment: number
  /** Positive = principal went up (e.g. capitalization) */
  deltaRemainingPrincipal: number
  newFirstDueDate: string | null
  newLastDueDate: string | null
}

export interface SimulationResult {
  type: ModificationType
  before: ScheduleSummary
  after: ScheduleSummary
  /** Full per-installment change set used during booking */
  changes: InstallmentChange[]
  impact: LoanImpact
  /** The new schedule to be inserted during booking (unpaid installments only) */
  newSchedule: InstallmentSnapshot[]
  /** Rate used for the new schedule (decimal) */
  newRateDecimal?: number
  /** New principal (may differ from original if capitalization occurred) */
  newPrincipal?: number
  simulatedAt: string   // ISO
}

// ─── Loan state snapshot passed to the simulator ─────────────────────────────

export interface LoanStateForSimulation {
  loanId: string
  organizationId: string
  remainingBalance: number      // Outstanding principal
  interestMethod: InterestMethod
  paymentFrequency: PaymentFrequency
  rateValue: number             // Normalized to whatever rateUnit says
  rateUnit: RateUnit
  customFrequencyDays?: number
  /** Only UNPAID (pending, partial, overdue) installments, sorted by installmentNumber asc */
  unpaidInstallments: InstallmentDoc[]
  /** Today's date (ISO YYYY-MM-DD) — injected so simulator stays pure/testable */
  today: string
}

// ─── Eligibility ──────────────────────────────────────────────────────────────

export interface EligibilityPolicy {
  allowedLoanStatuses: string[]
  allowedModificationTypes: ModificationType[]
  maxExtensionsPerLoan: number
  maxGracePeriodsPerLoan: number
  maxCapitalizationsPerLoan: number
  maxInterestOnlyPeriodsPerLoan: number
  maxRateReductionsPerLoan: number
  maxFullRestructuresPerLoan: number
  minDaysSinceDisbursement: number
  minDaysBetweenModifications: number
  maxTermExtensionInstallments: number    // Per modification
  maxCumulativeExtensionInstallments: number
  /** If true, a BOOKED modification with borrowerConsent.obtained === false is rejected */
  requireBorrowerConsent: boolean
  requireApproval: boolean
}

export const DEFAULT_POLICY: EligibilityPolicy = {
  allowedLoanStatuses: ['active', 'delinquent', 'disbursed'],
  allowedModificationTypes: [
    'DUE_DATE_CHANGE',
    'TERM_EXTENSION',
    'GRACE_PERIOD',
    'CAPITALIZE_ARREARS',
    'RATE_REDUCTION',
    'INTEREST_ONLY_PERIOD',
    'FULL_RESTRUCTURE',
  ],
  maxExtensionsPerLoan:              3,
  maxGracePeriodsPerLoan:            2,
  maxCapitalizationsPerLoan:         1,
  maxInterestOnlyPeriodsPerLoan:     2,
  maxRateReductionsPerLoan:          1,
  maxFullRestructuresPerLoan:        1,
  minDaysSinceDisbursement:          30,
  minDaysBetweenModifications:       7,
  maxTermExtensionInstallments:      24,
  maxCumulativeExtensionInstallments: 48,
  requireBorrowerConsent:            false,
  requireApproval:                   true,
}

export interface EligibilityViolation {
  code: string
  message: string
}

export interface EligibilityCheckResult {
  eligible: boolean
  violations: EligibilityViolation[]
  checkedAt: string   // ISO
  /** Policy that was evaluated (snapshot) */
  policy: EligibilityPolicy
}

// ─── Loan modification document (loan_modifications collection) ───────────────

export interface LoanModification {
  _id: string                  // UUID
  organizationId: string
  loanId: string
  clientId: string

  type: ModificationType
  status: ModificationStatus
  /** Sequential modification number for this loan (1, 2, 3 …) */
  sequenceNumber: number
  /** Which schedule version this produces when booked */
  targetVersionNumber: number

  // ── What was requested ──────────────────────────────────────────────────
  input: ModificationInput
  /** Reason provided at submission time (required for PENDING_APPROVAL and beyond) */
  submissionReason: string

  // ── Simulation ──────────────────────────────────────────────────────────
  simulation: SimulationResult
  /** Eligibility state at the moment the draft was created */
  eligibilitySnapshot: EligibilityCheckResult

  // ── Workflow timestamps & actors ────────────────────────────────────────
  createdBy: string     // userId
  createdAt: string

  submittedBy?: string
  submittedAt?: string

  reviewedBy?: string
  reviewedAt?: string
  reviewNotes?: string

  bookedBy?: string
  bookedAt?: string

  cancelledBy?: string
  cancelledAt?: string

  // ── Borrower consent (optional) ─────────────────────────────────────────
  borrowerConsent?: {
    obtained: boolean
    method?: 'verbal' | 'written' | 'digital'
    obtainedAt?: string
    obtainedBy?: string
    notes?: string
  }

  updatedAt: string
}

// ─── Schedule version (loan_schedule_versions collection) ─────────────────────

export interface LoanScheduleVersion {
  _id: string
  organizationId: string
  loanId: string
  /** 1 = original schedule captured at first modification; 2 = after mod 1; … */
  versionNumber: number
  source: 'ORIGINAL' | 'MODIFICATION'
  /** Which modification created this version (null for the original snapshot) */
  modificationId: string | null
  modificationId_sequence: number | null

  /** Financial summary at this version */
  remainingPrincipal: number
  totalScheduledInterest: number
  totalScheduledPayable: number
  installmentCount: number
  periodicPayment: number

  /** Full immutable schedule snapshot */
  installments: InstallmentSnapshot[]

  createdAt: string
  createdBy: string   // userId
}

// ─── Audit entry (modification_audit collection) ──────────────────────────────

export type AuditAction =
  | 'DRAFT_CREATED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'BOOKED'
  | 'CANCELLED'
  | 'CONSENT_RECORDED'

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  DRAFT_CREATED:     'Borrador creado',
  SUBMITTED:         'Enviado para aprobación',
  APPROVED:          'Aprobado',
  REJECTED:          'Rechazado',
  BOOKED:            'Aplicado al préstamo',
  CANCELLED:         'Cancelado',
  CONSENT_RECORDED:  'Consentimiento registrado',
}

export interface ModificationAuditEntry {
  _id: string
  organizationId: string
  loanId: string
  modificationId: string

  action: AuditAction
  fromStatus: ModificationStatus | null
  toStatus: ModificationStatus

  actorId: string
  actorName: string
  actorRole: string

  reason?: string
  notes?: string
  metadata?: Record<string, unknown>

  timestamp: string   // ISO
}

// ─── Validation helpers ───────────────────────────────────────────────────────

export const TERMINAL_STATUSES: ModificationStatus[] = ['BOOKED', 'REJECTED', 'CANCELLED']

export function isTerminal(status: ModificationStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function allowedTransitions(
  from: ModificationStatus,
): ModificationStatus[] {
  switch (from) {
    case 'DRAFT':            return ['PENDING_APPROVAL', 'CANCELLED']
    case 'PENDING_APPROVAL': return ['APPROVED', 'REJECTED', 'CANCELLED']
    case 'APPROVED':         return ['BOOKED', 'CANCELLED']
    default:                 return []
  }
}

export function canTransition(
  from: ModificationStatus,
  to: ModificationStatus,
): boolean {
  return allowedTransitions(from).includes(to)
}
