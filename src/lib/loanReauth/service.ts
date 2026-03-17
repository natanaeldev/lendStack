// ─── Reauthorization Session Service ─────────────────────────────────────────
// Manages the lifecycle of a reauth session for high-amount loans.
//
// Non-negotiables:
//  · No raw biometric data is stored — only provider references
//  · Every step transition is audited in loan_audit_logs
//  · Retry limits are enforced per policy

import type { Db } from 'mongodb'
import { v4 as uuid } from 'uuid'
import type { LoanReauthSession, LoanApprovalPolicy, VerificationStatus } from './types'
import { recordLoanAudit } from './audit'
import type { AuditActorContext } from './audit'

const SESSION_TTL_HOURS = 24

function expiresAt(): string {
  const d = new Date()
  d.setHours(d.getHours() + SESSION_TTL_HOURS)
  return d.toISOString()
}

// ─── Start a new reauth session ───────────────────────────────────────────────

export async function startReauthSession(
  db: Db,
  params: {
    organizationId: string
    loanId: string
    customerId: string
    agentId: string
    policyId: string
    maxRetries: number
  },
  actor: AuditActorContext,
): Promise<LoanReauthSession> {
  const now = new Date().toISOString()
  const session: LoanReauthSession = {
    _id:            uuid(),
    organizationId: params.organizationId,
    loanId:         params.loanId,
    customerId:     params.customerId,
    agentId:        params.agentId,
    policyId:       params.policyId,
    status:         'id_scan_pending',
    idScanStatus:   'pending',
    idScanReference:      null,
    idScanCompletedAt:    null,
    biometricType:        null,
    biometricStatus:      'pending',
    verificationReference: null,
    biometricCompletedAt: null,
    retryCount:     0,
    maxRetries:     params.maxRetries,
    createdAt:      now,
    completedAt:    null,
    expiresAt:      expiresAt(),
    metadata:       {},
  }

  await db.collection<LoanReauthSession>('loan_reauth_sessions').insertOne(session as any)

  // Update loan status
  await db.collection('loans').updateOne(
    { _id: params.loanId as any, organizationId: params.organizationId },
    {
      $set: {
        reauthStatus:    'REAUTH_IN_PROGRESS',
        reauthSessionId: session._id,
        status:          'reauth_in_progress',
        updatedAt:       now,
      },
    },
  )

  await recordLoanAudit(db, {
    organizationId: params.organizationId,
    loanId:    params.loanId,
    customerId: params.customerId,
    actor,
    eventType: 'reauth_started',
    eventPayload: { sessionId: session._id, policyId: params.policyId },
  })

  return session
}

// ─── Process ID scan ──────────────────────────────────────────────────────────

export async function processIdScan(
  db: Db,
  params: {
    organizationId: string
    sessionId: string
    /** S3/blob key — never store raw image data here */
    scanReference: string
    passed: boolean
  },
  actor: AuditActorContext,
): Promise<LoanReauthSession> {
  const session = await getSession(db, params.organizationId, params.sessionId)
  ensureNotExpiredOrTerminal(session)

  if (session.idScanStatus !== 'pending') {
    throw Object.assign(new Error('ID scan already processed'), { status: 400 })
  }

  const now = new Date().toISOString()
  const idScanStatus: VerificationStatus = params.passed ? 'passed' : 'failed'

  let newStatus: LoanReauthSession['status'] = params.passed ? 'biometric_pending' : session.status

  if (!params.passed) {
    const newRetry = session.retryCount + 1
    if (session.maxRetries > 0 && newRetry >= session.maxRetries) {
      newStatus = 'failed'
    }
    await db.collection('loan_reauth_sessions').updateOne(
      { _id: params.sessionId as any },
      { $set: { idScanStatus, idScanReference: params.scanReference, idScanCompletedAt: now, retryCount: newRetry, status: newStatus } },
    )
    if (newStatus === 'failed') {
      await failLoan(db, session, actor)
    }
    await recordLoanAudit(db, {
      organizationId: params.organizationId,
      loanId:    session.loanId,
      customerId: session.customerId,
      actor,
      eventType: params.passed ? 'id_scan_passed' : 'id_scan_failed',
      eventPayload: { sessionId: params.sessionId, reference: params.scanReference, retry: newRetry },
    })
    return getSession(db, params.organizationId, params.sessionId)
  }

  await db.collection('loan_reauth_sessions').updateOne(
    { _id: params.sessionId as any },
    { $set: { idScanStatus, idScanReference: params.scanReference, idScanCompletedAt: now, status: newStatus } },
  )

  await recordLoanAudit(db, {
    organizationId: params.organizationId,
    loanId:    session.loanId,
    customerId: session.customerId,
    actor,
    eventType: 'id_scan_passed',
    eventPayload: { sessionId: params.sessionId, reference: params.scanReference },
  })

  return getSession(db, params.organizationId, params.sessionId)
}

// ─── Process biometric verification ──────────────────────────────────────────

export async function processBiometric(
  db: Db,
  params: {
    organizationId: string
    sessionId: string
    biometricType: 'face' | 'fingerprint'
    /** Provider reference — no raw biometric data stored */
    verificationReference: string
    passed: boolean
  },
  actor: AuditActorContext,
): Promise<LoanReauthSession> {
  const session = await getSession(db, params.organizationId, params.sessionId)
  ensureNotExpiredOrTerminal(session)

  if (session.status !== 'biometric_pending') {
    throw Object.assign(new Error('Session not ready for biometric verification'), { status: 400 })
  }

  const now = new Date().toISOString()
  const biometricStatus: VerificationStatus = params.passed ? 'passed' : 'failed'

  if (!params.passed) {
    const newRetry = session.retryCount + 1
    const failed = session.maxRetries > 0 && newRetry >= session.maxRetries
    const newStatus: LoanReauthSession['status'] = failed ? 'failed' : 'biometric_pending'

    await db.collection('loan_reauth_sessions').updateOne(
      { _id: params.sessionId as any },
      {
        $set: {
          biometricType:        params.biometricType,
          biometricStatus,
          verificationReference: params.verificationReference,
          biometricCompletedAt: failed ? now : null,
          retryCount:           newRetry,
          status:               newStatus,
        },
      },
    )
    if (failed) await failLoan(db, session, actor)
    await recordLoanAudit(db, {
      organizationId: params.organizationId,
      loanId:    session.loanId,
      customerId: session.customerId,
      actor,
      eventType: 'biometric_failed',
      eventPayload: { sessionId: params.sessionId, type: params.biometricType, retry: newRetry },
    })
    return getSession(db, params.organizationId, params.sessionId)
  }

  // Passed
  await db.collection('loan_reauth_sessions').updateOne(
    { _id: params.sessionId as any },
    {
      $set: {
        biometricType:        params.biometricType,
        biometricStatus,
        verificationReference: params.verificationReference,
        biometricCompletedAt: now,
        status:               'biometric_complete',
      },
    },
  )

  await recordLoanAudit(db, {
    organizationId: params.organizationId,
    loanId:    session.loanId,
    customerId: session.customerId,
    actor,
    eventType: 'biometric_passed',
    eventPayload: { sessionId: params.sessionId, type: params.biometricType },
  })

  return getSession(db, params.organizationId, params.sessionId)
}

// ─── Finalize reauth session ──────────────────────────────────────────────────

export async function finalizeReauthSession(
  db: Db,
  params: { organizationId: string; sessionId: string },
  actor: AuditActorContext,
): Promise<LoanReauthSession> {
  const session = await getSession(db, params.organizationId, params.sessionId)
  ensureNotExpiredOrTerminal(session)

  if (session.status !== 'biometric_complete') {
    throw Object.assign(
      new Error('Cannot finalize: biometric verification not complete'),
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  await db.collection('loan_reauth_sessions').updateOne(
    { _id: params.sessionId as any },
    { $set: { status: 'completed', completedAt: now } },
  )

  // Update loan to reauth_completed and pending_approval
  await db.collection('loans').updateOne(
    { _id: session.loanId as any, organizationId: params.organizationId },
    {
      $set: {
        reauthStatus:  'REAUTH_COMPLETED',
        status:        'reauth_completed',
        updatedAt:     now,
      },
    },
  )

  await recordLoanAudit(db, {
    organizationId: params.organizationId,
    loanId:    session.loanId,
    customerId: session.customerId,
    actor,
    eventType: 'reauth_completed',
    eventPayload: { sessionId: params.sessionId },
  })

  return getSession(db, params.organizationId, params.sessionId)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function failLoan(
  db: Db,
  session: LoanReauthSession,
  actor: AuditActorContext,
): Promise<void> {
  const now = new Date().toISOString()
  await db.collection('loans').updateOne(
    { _id: session.loanId as any, organizationId: session.organizationId },
    {
      $set: {
        reauthStatus: 'REAUTH_FAILED',
        status:       'reauth_failed',
        updatedAt:    now,
      },
    },
  )
  await recordLoanAudit(db, {
    organizationId: session.organizationId,
    loanId:    session.loanId,
    customerId: session.customerId,
    actor,
    eventType: 'reauth_failed',
    eventPayload: { sessionId: session._id },
  })
}

function ensureNotExpiredOrTerminal(session: LoanReauthSession): void {
  if (session.status === 'completed' || session.status === 'failed') {
    throw Object.assign(new Error(`Session is already ${session.status}`), { status: 400 })
  }
  if (new Date(session.expiresAt) < new Date()) {
    throw Object.assign(new Error('Reauth session has expired'), { status: 400 })
  }
}

export async function getSession(
  db: Db,
  organizationId: string,
  sessionId: string,
): Promise<LoanReauthSession> {
  const session = await db
    .collection<LoanReauthSession>('loan_reauth_sessions')
    .findOne({ _id: sessionId as any, organizationId })
  if (!session) throw Object.assign(new Error('Session not found'), { status: 404 })
  return session as LoanReauthSession
}

export async function getSessionByLoanId(
  db: Db,
  organizationId: string,
  loanId: string,
): Promise<LoanReauthSession | null> {
  const session = await db
    .collection<LoanReauthSession>('loan_reauth_sessions')
    .findOne({ loanId, organizationId }, { sort: { createdAt: -1 } })
  return session as LoanReauthSession | null
}
