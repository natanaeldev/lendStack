// ─── Loan Reauth Audit Trail ──────────────────────────────────────────────────
// Every reauth/approval workflow event writes an immutable record to loan_audit_logs.

import type { Db } from 'mongodb'
import { v4 as uuid } from 'uuid'
import type { LoanAuditEventType, LoanAuditLog } from './types'

export interface AuditActorContext {
  actorId: string
  actorRole: string
}

export async function recordLoanAudit(
  db: Db,
  params: {
    organizationId: string
    loanId: string
    customerId?: string | null
    actor: AuditActorContext
    eventType: LoanAuditEventType
    eventPayload?: Record<string, unknown>
  },
): Promise<void> {
  const entry: LoanAuditLog = {
    _id:          uuid(),
    organizationId: params.organizationId,
    loanId:       params.loanId,
    customerId:   params.customerId ?? null,
    actorId:      params.actor.actorId,
    actorRole:    params.actor.actorRole,
    eventType:    params.eventType,
    eventPayload: params.eventPayload ?? {},
    createdAt:    new Date().toISOString(),
  }
  await db.collection<LoanAuditLog>('loan_audit_logs').insertOne(entry as any)
}

export async function getLoanAuditTrail(
  db: Db,
  organizationId: string,
  loanId: string,
): Promise<LoanAuditLog[]> {
  return db
    .collection<LoanAuditLog>('loan_audit_logs')
    .find({ organizationId, loanId })
    .sort({ createdAt: 1 })
    .toArray() as Promise<LoanAuditLog[]>
}

export async function recordAdminPolicyChange(
  db: Db,
  params: {
    organizationId: string
    policyType: 'threshold' | 'approval'
    policyId: string
    changedBy: string
    beforeData: Record<string, unknown> | null
    afterData: Record<string, unknown>
  },
): Promise<void> {
  await db.collection('admin_policy_change_logs').insertOne({
    _id:          uuid(),
    organizationId: params.organizationId,
    policyType:   params.policyType,
    policyId:     params.policyId,
    changedBy:    params.changedBy,
    beforeData:   params.beforeData,
    afterData:    params.afterData,
    createdAt:    new Date().toISOString(),
  } as any)
}
