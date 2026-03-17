// ─── Restructure Service ───────────────────────────────────────────────────────
// Stateful operations: workflow transitions, DB reads, and the critical
// booking logic that supersedes installments and creates schedule versions.
//
// Non-negotiables enforced here:
//  · PAID installments are never touched during booking
//  · Current schedule is snapshotted into loan_schedule_versions before any
//    installment is replaced
//  · Every transition writes to modification_audit via audit.ts
//  · canTransition() is called before every state mutation

import type { Db } from 'mongodb'
import { v4 as uuid } from 'uuid'
import { inferLegacyInterestMethod, inferLegacyPaymentFrequency } from '@/lib/loanEngine'
import type { InstallmentDoc } from '@/lib/loanDomain'
import { recordAudit, type ActorContext } from './audit'
import { checkEligibility, getOrgPolicy } from './policy'
import { simulateModification } from './simulator'
import {
  canTransition,
  isTerminal,
  type EligibilityCheckResult,
  type InstallmentSnapshot,
  type LoanModification,
  type LoanScheduleVersion,
  type LoanStateForSimulation,
  type ModificationInput,
  type ModificationStatus,
  type SimulationResult,
} from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowISO(): string {
  return new Date().toISOString()
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function serializeMod(doc: any): LoanModification {
  return { ...doc, _id: String(doc._id) }
}

// ─── Loan state reader ────────────────────────────────────────────────────────

/**
 * Fetches everything the simulator needs from the DB.
 * Returns null if the loan doesn't belong to the org or doesn't exist.
 */
export async function getLoanStateForSimulation(
  db: Db,
  loanId: string,
  organizationId: string,
): Promise<LoanStateForSimulation | null> {
  const loan = await db.collection('loans').findOne({
    _id:            loanId as any,
    organizationId,
  })
  if (!loan) return null

  // Only unpaid installments participate in simulations
  const unpaidRaw = await db
    .collection('installments')
    .find({
      loanId,
      organizationId,
      status: { $in: ['pending', 'partial', 'overdue'] },
      // Exclude installments already superseded by a previous modification
      supersededByModificationId: { $exists: false },
    })
    .sort({ installmentNumber: 1 })
    .toArray()

  const unpaidInstallments: InstallmentDoc[] = unpaidRaw.map(i => ({
    ...i,
    _id: String(i._id),
  })) as InstallmentDoc[]

  // Resolve interest method + frequency from the loan record
  const interestMethod = inferLegacyInterestMethod(
    loan.loanType,
    loan.interestMethod,
  )
  const paymentFrequency = inferLegacyPaymentFrequency(
    loan.loanType,
    loan.paymentFrequency ?? loan.carritoFrequency,
  )

  // Resolve the periodic rate (decimal) from whichever field is populated
  const rateValue = loan.rateValue ?? loan.monthlyRate ?? loan.weeklyRate ?? 0
  const rateUnit = loan.rateUnit ?? 'DECIMAL'

  return {
    loanId,
    organizationId,
    remainingBalance: loan.remainingBalance ?? 0,
    interestMethod,
    paymentFrequency,
    rateValue,
    rateUnit,
    customFrequencyDays: loan.customFrequencyDays,
    unpaidInstallments,
    today: todayISO(),
  }
}

// ─── Create draft ─────────────────────────────────────────────────────────────

export async function createModificationDraft(
  db: Db,
  params: {
    loanId: string
    organizationId: string
    actor: ActorContext
    input: ModificationInput
    submissionReason: string
    borrowerConsent?: LoanModification['borrowerConsent']
  },
): Promise<{ modification: LoanModification; eligibility: EligibilityCheckResult }> {
  const { loanId, organizationId, actor, input, submissionReason } = params

  // ── Fetch loan + client ──────────────────────────────────────────────────
  const loan = await db.collection('loans').findOne({
    _id: loanId as any, organizationId,
  })
  if (!loan) throw Object.assign(new Error('Préstamo no encontrado'), { status: 404 })

  // ── Policy + eligibility ─────────────────────────────────────────────────
  const policy = await getOrgPolicy(db, organizationId)

  const existingMods = await db
    .collection('loan_modifications')
    .find({ loanId, organizationId })
    .project({ type: 1, status: 1, bookedAt: 1 })
    .toArray()

  const eligibility = checkEligibility({
    loanStatus: loan.status,
    disbursedAt: loan.disbursedAt ?? loan.startDate,
    modificationTypeRequested: input.type,
    existingModifications: existingMods as any,
    today: todayISO(),
    policy,
  })

  // Eligibility violations are non-blocking for DRAFT — we record them and surface to UI.
  // If the org requires approval, violations will block booking regardless.
  // (A policy override can be added at submit time with an explicit reason.)

  // ── Simulation ────────────────────────────────────────────────────────────
  const state = await getLoanStateForSimulation(db, loanId, organizationId)
  if (!state) throw Object.assign(new Error('No se pudo leer el estado del préstamo'), { status: 500 })

  const simulation = simulateModification(state, input)

  // ── Sequence number ───────────────────────────────────────────────────────
  const count = await db
    .collection('loan_modifications')
    .countDocuments({ loanId, organizationId })

  const sequenceNumber     = count + 1
  const targetVersionNumber = sequenceNumber + 1   // v1 = original; v2 = after first mod, etc.

  // ── Build document ────────────────────────────────────────────────────────
  const now = nowISO()
  const modId = uuid()

  const doc: LoanModification = {
    _id:                modId,
    organizationId,
    loanId,
    clientId:           loan.clientId,
    type:               input.type,
    status:             'DRAFT',
    sequenceNumber,
    targetVersionNumber,
    input,
    submissionReason,
    simulation,
    eligibilitySnapshot: eligibility,
    createdBy:          actor.id,
    createdAt:          now,
    updatedAt:          now,
    ...(params.borrowerConsent ? { borrowerConsent: params.borrowerConsent } : {}),
  }

  await db.collection('loan_modifications').insertOne(doc as any)

  await recordAudit(db, {
    organizationId,
    loanId,
    modificationId: modId,
    action:         'DRAFT_CREATED',
    fromStatus:     null,
    toStatus:       'DRAFT',
    actor,
    reason:         submissionReason,
    metadata:       { type: input.type, eligibleAtCreation: eligibility.eligible },
  })

  return { modification: doc, eligibility }
}

// ─── Submit (DRAFT → PENDING_APPROVAL) ───────────────────────────────────────

export async function submitModification(
  db: Db,
  modId: string,
  organizationId: string,
  actor: ActorContext,
): Promise<void> {
  const mod = await getMod(db, modId, organizationId)
  assertTransition(mod.status, 'PENDING_APPROVAL')

  if (!mod.eligibilitySnapshot.eligible) {
    throw Object.assign(
      new Error('No se puede enviar: la solicitud no cumple con la política de elegibilidad.'),
      { status: 422, violations: mod.eligibilitySnapshot.violations },
    )
  }

  const now = nowISO()
  await db.collection('loan_modifications').updateOne(
    { _id: modId as any, organizationId },
    {
      $set: {
        status:       'PENDING_APPROVAL',
        submittedBy:  actor.id,
        submittedAt:  now,
        updatedAt:    now,
      },
    },
  )

  await recordAudit(db, {
    organizationId,
    loanId:         mod.loanId,
    modificationId: modId,
    action:         'SUBMITTED',
    fromStatus:     'DRAFT',
    toStatus:       'PENDING_APPROVAL',
    actor,
  })
}

// ─── Approve (PENDING_APPROVAL → APPROVED) ───────────────────────────────────

export async function approveModification(
  db: Db,
  modId: string,
  organizationId: string,
  actor: ActorContext,
  reviewNotes?: string,
): Promise<void> {
  const mod = await getMod(db, modId, organizationId)
  assertTransition(mod.status, 'APPROVED')

  const now = nowISO()
  await db.collection('loan_modifications').updateOne(
    { _id: modId as any, organizationId },
    {
      $set: {
        status:      'APPROVED',
        reviewedBy:  actor.id,
        reviewedAt:  now,
        reviewNotes: reviewNotes ?? null,
        updatedAt:   now,
      },
    },
  )

  await recordAudit(db, {
    organizationId,
    loanId:         mod.loanId,
    modificationId: modId,
    action:         'APPROVED',
    fromStatus:     'PENDING_APPROVAL',
    toStatus:       'APPROVED',
    actor,
    notes:          reviewNotes,
  })
}

// ─── Reject (PENDING_APPROVAL → REJECTED) ────────────────────────────────────

export async function rejectModification(
  db: Db,
  modId: string,
  organizationId: string,
  actor: ActorContext,
  reason: string,
): Promise<void> {
  const mod = await getMod(db, modId, organizationId)
  assertTransition(mod.status, 'REJECTED')

  const now = nowISO()
  await db.collection('loan_modifications').updateOne(
    { _id: modId as any, organizationId },
    {
      $set: {
        status:      'REJECTED',
        reviewedBy:  actor.id,
        reviewedAt:  now,
        reviewNotes: reason,
        updatedAt:   now,
      },
    },
  )

  await recordAudit(db, {
    organizationId,
    loanId:         mod.loanId,
    modificationId: modId,
    action:         'REJECTED',
    fromStatus:     'PENDING_APPROVAL',
    toStatus:       'REJECTED',
    actor,
    reason,
  })
}

// ─── Cancel (DRAFT | PENDING_APPROVAL | APPROVED → CANCELLED) ─────────────────

export async function cancelModification(
  db: Db,
  modId: string,
  organizationId: string,
  actor: ActorContext,
  reason?: string,
): Promise<void> {
  const mod = await getMod(db, modId, organizationId)
  assertTransition(mod.status, 'CANCELLED')

  const now = nowISO()
  await db.collection('loan_modifications').updateOne(
    { _id: modId as any, organizationId },
    {
      $set: {
        status:       'CANCELLED',
        cancelledBy:  actor.id,
        cancelledAt:  now,
        updatedAt:    now,
      },
    },
  )

  await recordAudit(db, {
    organizationId,
    loanId:         mod.loanId,
    modificationId: modId,
    action:         'CANCELLED',
    fromStatus:     mod.status,
    toStatus:       'CANCELLED',
    actor,
    reason,
  })
}

// ─── BOOK (APPROVED → BOOKED) — the critical path ────────────────────────────
//
// Steps:
//  1. Re-verify status = APPROVED (no double-booking)
//  2. Snapshot current schedule into loan_schedule_versions (v1 if first time)
//  3. For all unpaid, non-superseded installments: mark as superseded
//  4. Insert new installments from simulation.newSchedule
//  5. Update loans collection (balance, rates, summary fields)
//  6. Mark modification as BOOKED
//  7. Write audit entry
//  8. Save schedule version for the new state
//
// PAID installments are identified by status = 'paid' and are NEVER touched.

export async function bookModification(
  db: Db,
  modId: string,
  organizationId: string,
  actor: ActorContext,
): Promise<void> {
  const mod = await getMod(db, modId, organizationId)
  assertTransition(mod.status, 'BOOKED')

  const sim: SimulationResult = mod.simulation

  // ── Re-fetch the loan for an up-to-date balance snapshot ─────────────────
  const loan = await db.collection('loans').findOne({
    _id: mod.loanId as any, organizationId,
  })
  if (!loan) throw Object.assign(new Error('Préstamo no encontrado'), { status: 404 })

  // ── Step 2: Snapshot the CURRENT (pre-booking) installments ──────────────
  // We create the ORIGINAL version (v1) lazily on first booking.
  const existingVersions = await db
    .collection('loan_schedule_versions')
    .countDocuments({ loanId: mod.loanId, organizationId })

  const now = nowISO()

  if (existingVersions === 0) {
    // Capture original schedule as v1
    const allInstallments = await db
      .collection('installments')
      .find({ loanId: mod.loanId, organizationId })
      .sort({ installmentNumber: 1 })
      .toArray()

    await saveScheduleVersion(db, {
      organizationId,
      loanId:         mod.loanId,
      versionNumber:  1,
      source:         'ORIGINAL',
      modificationId: null,
      modificationId_sequence: null,
      installments:   allInstallments as any,
      loan,
      createdAt:      now,
      createdBy:      actor.id,
    })
  }

  // ── Step 3: Supersede all unpaid, non-superseded installments ────────────
  const supersededAt = now
  await db.collection('installments').updateMany(
    {
      loanId:         mod.loanId,
      organizationId,
      status: { $in: ['pending', 'partial', 'overdue'] },
      supersededByModificationId: { $exists: false },
    },
    {
      $set: {
        supersededByModificationId: modId,
        supersededAt,
      },
    },
  )

  // ── Step 4: Insert the new schedule ──────────────────────────────────────
  if (sim.newSchedule.length > 0) {
    const newInstallments = sim.newSchedule.map((snap: InstallmentSnapshot) => ({
      _id:                uuid(),
      organizationId,
      loanId:             mod.loanId,
      clientId:           mod.clientId,
      installmentNumber:  snap.installmentNumber,
      dueDate:            snap.dueDate,
      periodLabel:        `Cuota ${snap.installmentNumber}`,
      scheduledPrincipal: snap.scheduledPrincipal,
      scheduledInterest:  snap.scheduledInterest,
      scheduledAmount:    snap.scheduledAmount,
      paidPrincipal:      0,
      paidInterest:       0,
      paidAmount:         0,
      remainingAmount:    snap.scheduledAmount,
      status:             'pending' as const,
      scheduleVersion:    mod.targetVersionNumber,
      createdFromModificationId: modId,
    }))

    await db.collection('installments').insertMany(newInstallments as any)
  }

  // ── Step 5: Update the loan document ─────────────────────────────────────
  const loanUpdate: Record<string, any> = {
    updatedAt: now,
  }

  if (sim.newPrincipal !== undefined && sim.newPrincipal !== loan.remainingBalance) {
    loanUpdate.remainingBalance = sim.newPrincipal
  }

  if (sim.after.periodicPayment) {
    loanUpdate.scheduledPayment = sim.after.periodicPayment
  }

  if (sim.newRateDecimal !== undefined) {
    loanUpdate.rateValue = sim.newRateDecimal
    loanUpdate.rateUnit  = 'DECIMAL'
  }

  // Recalculate totals from new schedule
  const newTotalInterest = sim.after.totalRemainingInterest
  const newTotalPayable  = sim.after.totalRemainingPayable
  if (newTotalInterest) loanUpdate.totalInterest = newTotalInterest
  if (newTotalPayable)  loanUpdate.totalPayment  = newTotalPayable

  await db.collection('loans').updateOne(
    { _id: mod.loanId as any, organizationId },
    { $set: loanUpdate },
  )

  // ── Step 6: Mark modification as BOOKED ──────────────────────────────────
  await db.collection('loan_modifications').updateOne(
    { _id: modId as any, organizationId },
    {
      $set: {
        status:    'BOOKED',
        bookedBy:  actor.id,
        bookedAt:  now,
        updatedAt: now,
      },
    },
  )

  // ── Step 7: Audit ─────────────────────────────────────────────────────────
  await recordAudit(db, {
    organizationId,
    loanId:         mod.loanId,
    modificationId: modId,
    action:         'BOOKED',
    fromStatus:     'APPROVED',
    toStatus:       'BOOKED',
    actor,
    metadata: {
      newScheduleCount:       sim.newSchedule.length,
      deltaTotalPayable:      sim.impact.deltaTotalPayable,
      deltaRemainingPrincipal: sim.impact.deltaRemainingPrincipal,
      newVersionNumber:       mod.targetVersionNumber,
    },
  })

  // ── Step 8: Save the post-booking schedule version ────────────────────────
  const newAllInstallments = await db
    .collection('installments')
    .find({
      loanId: mod.loanId,
      organizationId,
      supersededByModificationId: { $exists: false },
    })
    .sort({ installmentNumber: 1 })
    .toArray()

  const updatedLoan = await db.collection('loans').findOne({ _id: mod.loanId as any })

  await saveScheduleVersion(db, {
    organizationId,
    loanId:         mod.loanId,
    versionNumber:  mod.targetVersionNumber,
    source:         'MODIFICATION',
    modificationId: modId,
    modificationId_sequence: mod.sequenceNumber,
    installments:   newAllInstallments as any,
    loan:           updatedLoan ?? loan,
    createdAt:      now,
    createdBy:      actor.id,
  })
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listModifications(
  db: Db,
  loanId: string,
  organizationId: string,
): Promise<LoanModification[]> {
  const docs = await db
    .collection('loan_modifications')
    .find({ loanId, organizationId })
    .sort({ sequenceNumber: 1 })
    .toArray()

  return docs.map(serializeMod)
}

export async function getModification(
  db: Db,
  modId: string,
  organizationId: string,
): Promise<LoanModification | null> {
  const doc = await db.collection('loan_modifications').findOne({
    _id: modId as any, organizationId,
  })
  return doc ? serializeMod(doc) : null
}

export async function listScheduleVersions(
  db: Db,
  loanId: string,
  organizationId: string,
): Promise<LoanScheduleVersion[]> {
  const docs = await db
    .collection('loan_schedule_versions')
    .find({ loanId, organizationId })
    .sort({ versionNumber: 1 })
    .toArray()

  return docs.map(d => ({ ...d, _id: String(d._id) })) as LoanScheduleVersion[]
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getMod(db: Db, modId: string, organizationId: string): Promise<LoanModification> {
  const doc = await db.collection('loan_modifications').findOne({
    _id: modId as any, organizationId,
  })
  if (!doc) throw Object.assign(new Error('Modificación no encontrada'), { status: 404 })
  return serializeMod(doc)
}

function assertTransition(from: ModificationStatus, to: ModificationStatus): void {
  if (isTerminal(from)) {
    throw Object.assign(
      new Error(`La modificación está en estado terminal "${from}" y no puede cambiar a "${to}".`),
      { status: 409 },
    )
  }
  if (!canTransition(from, to)) {
    throw Object.assign(
      new Error(`Transición no permitida: "${from}" → "${to}".`),
      { status: 409 },
    )
  }
}

async function saveScheduleVersion(
  db: Db,
  params: {
    organizationId: string
    loanId: string
    versionNumber: number
    source: 'ORIGINAL' | 'MODIFICATION'
    modificationId: string | null
    modificationId_sequence: number | null
    installments: InstallmentDoc[]
    loan: any
    createdAt: string
    createdBy: string
  },
): Promise<void> {
  const { installments, loan } = params

  const snapshots: InstallmentSnapshot[] = installments.map(i => ({
    installmentNumber: i.installmentNumber,
    dueDate:           i.dueDate,
    scheduledPrincipal: i.scheduledPrincipal,
    scheduledInterest:  i.scheduledInterest,
    scheduledAmount:    i.scheduledAmount,
    status:            i.status,
    paidAmount:        i.paidAmount ?? 0,
  }))

  const totalInterest = snapshots.reduce((s, r) => s + r.scheduledInterest, 0)
  const totalPayable  = snapshots.reduce((s, r) => s + r.scheduledAmount, 0)

  const version: LoanScheduleVersion = {
    _id:                    uuid(),
    organizationId:         params.organizationId,
    loanId:                 params.loanId,
    versionNumber:          params.versionNumber,
    source:                 params.source,
    modificationId:         params.modificationId,
    modificationId_sequence: params.modificationId_sequence,
    remainingPrincipal:     loan.remainingBalance ?? 0,
    totalScheduledInterest: Math.round(totalInterest * 100) / 100,
    totalScheduledPayable:  Math.round(totalPayable * 100) / 100,
    installmentCount:       snapshots.length,
    periodicPayment:        snapshots[0]?.scheduledAmount ?? 0,
    installments:           snapshots,
    createdAt:              params.createdAt,
    createdBy:              params.createdBy,
  }

  await db.collection('loan_schedule_versions').insertOne(version as any)
}
