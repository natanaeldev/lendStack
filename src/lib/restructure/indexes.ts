// ─── Restructure Module — MongoDB Index Definitions ───────────────────────────
// Run this once on deployment (or via a migration script).
// Idempotent: createIndex is a no-op if the index already exists.

import type { Db } from 'mongodb'

export async function ensureRestructureIndexes(db: Db): Promise<void> {
  // loan_modifications
  await db.collection('loan_modifications').createIndexes([
    { key: { organizationId: 1, loanId: 1 },              name: 'org_loan' },
    { key: { organizationId: 1, loanId: 1, status: 1 },   name: 'org_loan_status' },
    { key: { organizationId: 1, loanId: 1, type: 1, status: 1 }, name: 'org_loan_type_status' },
    { key: { createdAt: -1 },                              name: 'created_at_desc' },
  ])

  // loan_schedule_versions
  await db.collection('loan_schedule_versions').createIndexes([
    { key: { organizationId: 1, loanId: 1, versionNumber: 1 }, name: 'org_loan_version', unique: true },
    { key: { modificationId: 1 },                               name: 'modification_id' },
  ])

  // modification_audit
  await db.collection('modification_audit').createIndexes([
    { key: { organizationId: 1, modificationId: 1 }, name: 'org_mod' },
    { key: { organizationId: 1, loanId: 1 },         name: 'org_loan' },
    { key: { timestamp: 1 },                          name: 'timestamp_asc' },
  ])

  // installments (additive — add the superseded fields index)
  await db.collection('installments').createIndex(
    { loanId: 1, supersededByModificationId: 1, status: 1 },
    { name: 'loan_superseded_status', sparse: true },
  )
}
