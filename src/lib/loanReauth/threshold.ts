// ─── Threshold Evaluation Service ────────────────────────────────────────────
// Resolves which threshold policy applies for a given loan request and evaluates
// whether the requested amount exceeds it.
//
// Priority order (most specific wins):
//   agent > agent_role > branch > product > global

import type { Db } from 'mongodb'
import type {
  LoanThresholdPolicy,
  LoanApprovalPolicy,
  ThresholdEvaluationResult,
  ThresholdScopeType,
} from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCOPE_PRIORITY: Record<ThresholdScopeType, number> = {
  agent:      5,
  agent_role: 4,
  branch:     3,
  product:    2,
  global:     1,
}

function pickBest<T extends { scopeType: ThresholdScopeType }>(policies: T[]): T | null {
  if (!policies.length) return null
  return policies.reduce((best, cur) =>
    SCOPE_PRIORITY[cur.scopeType] > SCOPE_PRIORITY[best.scopeType] ? cur : best,
  )
}

// ─── Query builders ───────────────────────────────────────────────────────────

function buildScopeFilter(
  agentId: string,
  agentRole: string,
  branchId: string | null,
  product: string | null,
): object {
  const orClauses: object[] = [
    { scopeType: 'global' },
  ]
  if (agentId) orClauses.push({ scopeType: 'agent', scopeId: agentId })
  if (agentRole) orClauses.push({ scopeType: 'agent_role', scopeId: agentRole })
  if (branchId) orClauses.push({ scopeType: 'branch', scopeId: branchId })
  if (product) orClauses.push({ scopeType: 'product', scopeId: product })
  return { $or: orClauses }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ThresholdEvaluationInput {
  organizationId: string
  agentId: string
  agentRole: string
  branchId?: string | null
  product?: string | null
  requestedAmount: number
  currency: string
}

/**
 * Evaluates whether a loan amount exceeds the configured threshold for the agent.
 * Returns the most specific applicable policy and whether the threshold was exceeded.
 */
export async function evaluateThreshold(
  db: Db,
  input: ThresholdEvaluationInput,
): Promise<ThresholdEvaluationResult> {
  const {
    organizationId,
    agentId,
    agentRole,
    branchId = null,
    product = null,
    requestedAmount,
    currency,
  } = input

  const scopeFilter = buildScopeFilter(agentId, agentRole, branchId, product)

  const policies = await db
    .collection<LoanThresholdPolicy>('loan_threshold_policies')
    .find({
      organizationId,
      active: true,
      currency,
      ...scopeFilter,
    })
    .toArray()

  const best = pickBest(policies)

  if (!best) {
    // No policy configured → threshold not applicable
    return {
      exceeded: false,
      thresholdAmount: Infinity,
      currency,
      requestedAmount,
      applicablePolicy: null,
      applicableApprovalPolicy: null,
    }
  }

  const exceeded = requestedAmount > best.thresholdAmount

  let approvalPolicy: LoanApprovalPolicy | null = null
  if (exceeded) {
    approvalPolicy = await resolveApprovalPolicy(db, {
      organizationId,
      agentId,
      agentRole,
      branchId,
      product,
      amount: requestedAmount,
      currency,
    })
  }

  return {
    exceeded,
    thresholdAmount: best.thresholdAmount,
    currency,
    requestedAmount,
    applicablePolicy: best,
    applicableApprovalPolicy: approvalPolicy,
  }
}

// ─── Approval policy resolution ───────────────────────────────────────────────

export interface ApprovalPolicyResolutionInput {
  organizationId: string
  agentId: string
  agentRole: string
  branchId?: string | null
  product?: string | null
  amount: number
  currency: string
}

export async function resolveApprovalPolicy(
  db: Db,
  input: ApprovalPolicyResolutionInput,
): Promise<LoanApprovalPolicy | null> {
  const { organizationId, agentId, agentRole, branchId = null, product = null, amount, currency } = input

  const scopeFilter = buildScopeFilter(agentId, agentRole, branchId, product)

  const policies = await db
    .collection<LoanApprovalPolicy>('loan_approval_policies')
    .find({
      organizationId,
      active: true,
      currency,
      minAmount: { $lte: amount },
      $or: [
        { maxAmount: null },
        { maxAmount: { $gt: amount } },
      ],
      ...scopeFilter,
    })
    .toArray()

  return pickBest(policies)
}
