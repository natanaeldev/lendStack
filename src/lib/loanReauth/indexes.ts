// ─── MongoDB Indexes for Reauth Module ───────────────────────────────────────

import type { Db } from 'mongodb'

export async function ensureReauthIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection('loan_threshold_policies').createIndex({ organizationId: 1, active: 1, currency: 1, scopeType: 1 }),
    db.collection('loan_threshold_policies').createIndex({ organizationId: 1, scopeType: 1, scopeId: 1 }),

    db.collection('loan_approval_policies').createIndex({ organizationId: 1, active: 1, currency: 1, minAmount: 1 }),
    db.collection('loan_approval_policies').createIndex({ organizationId: 1, scopeType: 1, scopeId: 1 }),

    db.collection('loan_reauth_sessions').createIndex({ organizationId: 1, loanId: 1 }),
    db.collection('loan_reauth_sessions').createIndex({ organizationId: 1, status: 1 }),
    db.collection('loan_reauth_sessions').createIndex({ loanId: 1, status: 1 }),

    db.collection('loan_approvals').createIndex({ organizationId: 1, loanId: 1 }),
    db.collection('loan_approvals').createIndex({ organizationId: 1, approverUserId: 1, status: 1 }),
    db.collection('loan_approvals').createIndex({ loanId: 1, status: 1, sequenceOrder: 1 }),

    db.collection('loan_audit_logs').createIndex({ organizationId: 1, loanId: 1, createdAt: 1 }),
    db.collection('loan_audit_logs').createIndex({ organizationId: 1, actorId: 1, createdAt: -1 }),

    db.collection('admin_policy_change_logs').createIndex({ organizationId: 1, policyType: 1, createdAt: -1 }),
  ])
}
