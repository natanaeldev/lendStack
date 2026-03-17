// ─── Restructure Eligibility Policy ──────────────────────────────────────────
// Policy is resolved per org from the database, falling back to DEFAULT_POLICY.
// checkEligibility is pure — it takes a snapshot, returns violations.
// No DB access in this file.

import type { Db } from 'mongodb'
import {
  DEFAULT_POLICY,
  type EligibilityCheckResult,
  type EligibilityPolicy,
  type EligibilityViolation,
  type LoanModification,
  type ModificationType,
} from './types'

// ─── Org policy resolver ──────────────────────────────────────────────────────

/**
 * Reads restructure policy from the organizations collection.
 * Falls back to DEFAULT_POLICY for any missing fields.
 * Called once per modification request — result should be included in
 * the eligibilitySnapshot so auditors know which rules applied.
 */
export async function getOrgPolicy(
  db: Db,
  organizationId: string,
): Promise<EligibilityPolicy> {
  const org = await db.collection('organizations').findOne(
    { _id: organizationId as any },
    { projection: { restructurePolicy: 1 } },
  )
  // Merge org overrides onto defaults so the org can tighten or loosen rules
  const overrides: Partial<EligibilityPolicy> = (org?.restructurePolicy as any) ?? {}
  return { ...DEFAULT_POLICY, ...overrides }
}

// ─── Eligibility check ────────────────────────────────────────────────────────

interface CheckInput {
  loanStatus: string
  disbursedAt: string | undefined
  modificationTypeRequested: ModificationType
  existingModifications: Pick<LoanModification, 'type' | 'status' | 'bookedAt'>[]
  today: string   // ISO YYYY-MM-DD — injected for testability
  policy: EligibilityPolicy
}

export function checkEligibility(input: CheckInput): EligibilityCheckResult {
  const violations: EligibilityViolation[] = []
  const { loanStatus, disbursedAt, modificationTypeRequested, existingModifications, today, policy } = input

  // ── 1. Loan must be in an allowed status ────────────────────────────────
  if (!policy.allowedLoanStatuses.includes(loanStatus)) {
    violations.push({
      code: 'LOAN_STATUS_NOT_ALLOWED',
      message: `Estado del préstamo "${loanStatus}" no permite modificaciones. Estados permitidos: ${policy.allowedLoanStatuses.join(', ')}.`,
    })
  }

  // ── 2. Modification type must be enabled ─────────────────────────────────
  if (!policy.allowedModificationTypes.includes(modificationTypeRequested)) {
    violations.push({
      code: 'MODIFICATION_TYPE_NOT_ALLOWED',
      message: `El tipo de modificación "${modificationTypeRequested}" no está habilitado para esta organización.`,
    })
  }

  // ── 3. No pending (not yet terminal) modification already open ───────────
  const openMod = existingModifications.find(
    m => m.status === 'DRAFT' || m.status === 'PENDING_APPROVAL' || m.status === 'APPROVED',
  )
  if (openMod) {
    violations.push({
      code: 'MODIFICATION_ALREADY_OPEN',
      message: 'Existe una modificación en progreso para este préstamo. Debe completarse o cancelarse antes de crear una nueva.',
    })
  }

  // ── 4. Minimum days since disbursement ───────────────────────────────────
  if (disbursedAt && policy.minDaysSinceDisbursement > 0) {
    const daysSince = diffDays(disbursedAt.slice(0, 10), today)
    if (daysSince < policy.minDaysSinceDisbursement) {
      violations.push({
        code: 'TOO_SOON_SINCE_DISBURSEMENT',
        message: `El préstamo fue desembolsado hace ${daysSince} días. Se requieren al menos ${policy.minDaysSinceDisbursement} días.`,
      })
    }
  }

  // ── 5. Minimum days since last booked modification ───────────────────────
  if (policy.minDaysBetweenModifications > 0) {
    const bookedMods = existingModifications
      .filter(m => m.status === 'BOOKED' && m.bookedAt)
      .map(m => m.bookedAt as string)
      .sort()
    const lastBooked = bookedMods[bookedMods.length - 1]
    if (lastBooked) {
      const daysSince = diffDays(lastBooked.slice(0, 10), today)
      if (daysSince < policy.minDaysBetweenModifications) {
        violations.push({
          code: 'TOO_SOON_SINCE_LAST_MODIFICATION',
          message: `La última modificación fue hace ${daysSince} días. Se requieren al menos ${policy.minDaysBetweenModifications} días entre modificaciones.`,
        })
      }
    }
  }

  // ── 6. Per-type frequency caps ────────────────────────────────────────────
  const bookedOfType = (t: ModificationType) =>
    existingModifications.filter(m => m.type === t && m.status === 'BOOKED').length

  const typeCaps: { type: ModificationType; max: number; label: string }[] = [
    { type: 'TERM_EXTENSION',       max: policy.maxExtensionsPerLoan,           label: 'extensiones de plazo' },
    { type: 'GRACE_PERIOD',         max: policy.maxGracePeriodsPerLoan,          label: 'períodos de gracia' },
    { type: 'CAPITALIZE_ARREARS',   max: policy.maxCapitalizationsPerLoan,       label: 'capitalizaciones de mora' },
    { type: 'INTEREST_ONLY_PERIOD', max: policy.maxInterestOnlyPeriodsPerLoan,   label: 'períodos de solo interés' },
    { type: 'RATE_REDUCTION',       max: policy.maxRateReductionsPerLoan,        label: 'reducciones de tasa' },
    { type: 'FULL_RESTRUCTURE',     max: policy.maxFullRestructuresPerLoan,      label: 'reestructuraciones totales' },
  ]

  if (modificationTypeRequested !== 'DUE_DATE_CHANGE') {
    for (const cap of typeCaps) {
      if (cap.type === modificationTypeRequested) {
        const count = bookedOfType(cap.type)
        if (count >= cap.max) {
          violations.push({
            code: `MAX_${cap.type}_EXCEEDED`,
            message: `Se alcanzó el límite máximo de ${cap.max} ${cap.label} para este préstamo (actual: ${count}).`,
          })
        }
        break
      }
    }
  }

  return {
    eligible: violations.length === 0,
    violations,
    checkedAt: new Date().toISOString(),
    policy,
  }
}

// ─── Cumulative extension check ───────────────────────────────────────────────
// Called separately because it requires the simulation result

export function checkCumulativeExtension(
  requestedAdditionalInstallments: number,
  existingBookedExtensions: { additionalInstallments: number }[],
  policy: EligibilityPolicy,
): EligibilityViolation | null {
  if (policy.maxCumulativeExtensionInstallments <= 0) return null

  const totalAdded = existingBookedExtensions.reduce(
    (sum, e) => sum + (e.additionalInstallments ?? 0),
    0,
  )
  const projected = totalAdded + requestedAdditionalInstallments

  if (projected > policy.maxCumulativeExtensionInstallments) {
    return {
      code: 'MAX_CUMULATIVE_EXTENSION_EXCEEDED',
      message: `Las extensiones acumuladas superarían el límite de ${policy.maxCumulativeExtensionInstallments} cuotas (actual: ${totalAdded}, solicitado: +${requestedAdditionalInstallments}).`,
    }
  }

  return null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function diffDays(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`)
  const b = new Date(`${to}T12:00:00`)
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
}
