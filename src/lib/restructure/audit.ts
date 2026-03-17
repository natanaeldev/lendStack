// ─── Modification Audit Trail ─────────────────────────────────────────────────
// Every workflow transition writes an immutable record to modification_audit.
// Callers supply the actor context; this module handles persistence and retrieval.

import type { Db } from 'mongodb'
import { v4 as uuid } from 'uuid'
import type {
  AuditAction,
  ModificationAuditEntry,
  ModificationStatus,
} from './types'

export interface ActorContext {
  id: string
  name: string
  role: string
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function recordAudit(
  db: Db,
  params: {
    organizationId: string
    loanId: string
    modificationId: string
    action: AuditAction
    fromStatus: ModificationStatus | null
    toStatus: ModificationStatus
    actor: ActorContext
    reason?: string
    notes?: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const entry: ModificationAuditEntry = {
    _id:            uuid(),
    organizationId: params.organizationId,
    loanId:         params.loanId,
    modificationId: params.modificationId,
    action:         params.action,
    fromStatus:     params.fromStatus,
    toStatus:       params.toStatus,
    actorId:        params.actor.id,
    actorName:      params.actor.name,
    actorRole:      params.actor.role,
    reason:         params.reason,
    notes:          params.notes,
    metadata:       params.metadata,
    timestamp:      new Date().toISOString(),
  }

  await db.collection('modification_audit').insertOne(entry as any)
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getAuditTrail(
  db: Db,
  modificationId: string,
  organizationId: string,
): Promise<ModificationAuditEntry[]> {
  const rows = await db
    .collection('modification_audit')
    .find({ modificationId, organizationId })
    .sort({ timestamp: 1 })
    .toArray()

  return rows.map(r => ({ ...r, _id: String(r._id) })) as ModificationAuditEntry[]
}

export async function getAuditTrailForLoan(
  db: Db,
  loanId: string,
  organizationId: string,
): Promise<ModificationAuditEntry[]> {
  const rows = await db
    .collection('modification_audit')
    .find({ loanId, organizationId })
    .sort({ timestamp: 1 })
    .toArray()

  return rows.map(r => ({ ...r, _id: String(r._id) })) as ModificationAuditEntry[]
}
