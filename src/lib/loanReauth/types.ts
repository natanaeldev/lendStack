// ─── Loan Reauthorization & Multi-Level Approval — Domain Types ──────────────
// Non-negotiables:
//  · No raw biometric data is stored — only provider references or hashes
//  · Every workflow transition is recorded in loan_audit_logs
//  · Disbursement is blocked until all required approvals are in

// ─── Extended Loan Status ─────────────────────────────────────────────────────

export type ReauthLoanStatus =
  | 'REAUTH_REQUIRED'
  | 'REAUTH_IN_PROGRESS'
  | 'REAUTH_FAILED'
  | 'REAUTH_COMPLETED'
  | 'PENDING_APPROVAL'
  | 'PENDING_MANAGER_APPROVAL'
  | 'PENDING_MASTER_APPROVAL'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  | 'DISBURSEMENT_BLOCKED'
  | 'READY_FOR_DISBURSEMENT'

// ─── Threshold Policy ─────────────────────────────────────────────────────────

export type ThresholdScopeType =
  | 'global'
  | 'branch'
  | 'product'
  | 'agent_role'
  | 'agent'

export interface LoanThresholdPolicy {
  _id: string
  organizationId: string
  active: boolean
  scopeType: ThresholdScopeType
  /** null for global; branchId / product name / role name / userId for others */
  scopeId: string | null
  thresholdAmount: number
  currency: string
  createdAt: string
  updatedAt: string
  createdBy: string
}

// ─── Approval Policy ──────────────────────────────────────────────────────────

export type ApprovalMode =
  | 'sequential'
  | 'parallel'
  | 'all_required'
  | 'minimum_count'

export type RejectionMode =
  | 'terminal'        // Any rejection immediately rejects the loan
  | 'majority'        // Rejection only matters if majority reject

export type BiometricMode =
  | 'face_only'
  | 'fingerprint_only'
  | 'either'

export type ApproverType = 'manager' | 'master' | 'custom_role' | 'specific_user'

export interface ApproverDefinition {
  type: ApproverType
  /** For custom_role: the role name. For specific_user: the userId */
  value?: string
}

export interface LoanApprovalPolicy {
  _id: string
  organizationId: string
  name: string
  active: boolean
  scopeType: ThresholdScopeType
  scopeId: string | null
  /** Apply this policy when loan amount >= minAmount */
  minAmount: number
  /** Apply this policy when loan amount < maxAmount (null = no upper bound) */
  maxAmount: number | null
  currency: string
  approvalMode: ApprovalMode
  /** Required when mode is minimum_count */
  requiredApprovalCount: number
  rejectionMode: RejectionMode
  approvers: ApproverDefinition[]
  biometricMode: BiometricMode
  /** Max retries for biometric/ID scan (0 = unlimited) */
  retryLimit: number
  /** Notification channels to use when a new approval is required */
  notificationChannels: string[]
  /** Optional second threshold amount for stricter rules */
  secondThresholdAmount: number | null
  secondApprovalPolicy?: Omit<LoanApprovalPolicy, '_id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'secondThresholdAmount' | 'secondApprovalPolicy'>
  createdAt: string
  updatedAt: string
  createdBy: string
}

// ─── Reauthorization Session ──────────────────────────────────────────────────

export type ReauthSessionStatus =
  | 'initiated'
  | 'id_scan_pending'
  | 'id_scan_complete'
  | 'biometric_pending'
  | 'biometric_complete'
  | 'completed'
  | 'failed'
  | 'expired'

export type VerificationStatus = 'pending' | 'passed' | 'failed'

export interface LoanReauthSession {
  _id: string
  organizationId: string
  loanId: string
  customerId: string
  agentId: string
  policyId: string

  status: ReauthSessionStatus

  idScanStatus: VerificationStatus
  /** S3/blob key for the ID scan artifact (not raw data) */
  idScanReference: string | null
  idScanCompletedAt: string | null

  biometricType: 'face' | 'fingerprint' | null
  biometricStatus: VerificationStatus
  /** Reference to biometric provider result — no raw data stored */
  verificationReference: string | null
  biometricCompletedAt: string | null

  retryCount: number
  maxRetries: number

  createdAt: string
  completedAt: string | null
  expiresAt: string
  metadata: Record<string, unknown>
}

// ─── Loan Approval ────────────────────────────────────────────────────────────

export type ApprovalTaskStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'skipped'   // e.g. minimum_count already reached

export interface LoanApproval {
  _id: string
  organizationId: string
  loanId: string
  policyId: string

  approverUserId: string | null   // null = awaiting assignment to role-based user
  approverRole: string
  status: ApprovalTaskStatus
  comments: string | null
  decidedAt: string | null

  /** For sequential mode: 1, 2, 3 … */
  sequenceOrder: number

  createdAt: string
  updatedAt: string
}

// ─── Loan Audit Log ───────────────────────────────────────────────────────────

export type LoanAuditEventType =
  | 'loan_created'
  | 'threshold_exceeded'
  | 'reauth_started'
  | 'id_scan_submitted'
  | 'id_scan_passed'
  | 'id_scan_failed'
  | 'biometric_submitted'
  | 'biometric_passed'
  | 'biometric_failed'
  | 'reauth_completed'
  | 'reauth_failed'
  | 'approval_request_created'
  | 'notification_sent'
  | 'approval_task_approved'
  | 'approval_task_rejected'
  | 'loan_fully_approved'
  | 'loan_fully_rejected'
  | 'disbursement_unlocked'
  | 'disbursement_blocked'

export interface LoanAuditLog {
  _id: string
  organizationId: string
  loanId: string
  customerId: string | null
  actorId: string
  actorRole: string
  eventType: LoanAuditEventType
  eventPayload: Record<string, unknown>
  createdAt: string
}

// ─── Admin Policy Change Log ──────────────────────────────────────────────────

export type PolicyType = 'threshold' | 'approval'

export interface AdminPolicyChangeLog {
  _id: string
  organizationId: string
  policyType: PolicyType
  policyId: string
  changedBy: string
  beforeData: Record<string, unknown> | null
  afterData: Record<string, unknown>
  createdAt: string
}

// ─── Threshold Evaluation Result ─────────────────────────────────────────────

export interface ThresholdEvaluationResult {
  exceeded: boolean
  thresholdAmount: number
  currency: string
  requestedAmount: number
  applicablePolicy: LoanThresholdPolicy | null
  applicableApprovalPolicy: LoanApprovalPolicy | null
}

// ─── Status machine helpers ───────────────────────────────────────────────────

export const REAUTH_TERMINAL_STATUSES: ReauthSessionStatus[] = ['completed', 'failed', 'expired']

export function isReauthTerminal(status: ReauthSessionStatus): boolean {
  return REAUTH_TERMINAL_STATUSES.includes(status)
}

// ─── Extended LoanDoc fields ──────────────────────────────────────────────────
// These augment the base LoanDoc — stored as additional fields in the loans collection.

export interface LoanReauthFields {
  requiresReauth?: boolean
  reauthStatus?: ReauthLoanStatus | null
  reauthSessionId?: string | null
  approvalStatus?: 'pending' | 'approved' | 'rejected' | null
  disbursementLocked?: boolean
  triggeredPolicyId?: string | null
  triggeredThresholdAmount?: number | null
}

// ─── Label maps ───────────────────────────────────────────────────────────────

export const REAUTH_STATUS_LABELS: Record<ReauthLoanStatus, string> = {
  REAUTH_REQUIRED:            'Reautorización requerida',
  REAUTH_IN_PROGRESS:         'Reautorización en progreso',
  REAUTH_FAILED:              'Reautorización fallida',
  REAUTH_COMPLETED:           'Reautorización completada',
  PENDING_APPROVAL:           'Pendiente de aprobación',
  PENDING_MANAGER_APPROVAL:   'Pendiente de aprobación del gerente',
  PENDING_MASTER_APPROVAL:    'Pendiente de aprobación del maestro',
  APPROVAL_APPROVED:          'Aprobado',
  APPROVAL_REJECTED:          'Rechazado',
  DISBURSEMENT_BLOCKED:       'Desembolso bloqueado',
  READY_FOR_DISBURSEMENT:     'Listo para desembolso',
}

export const REAUTH_STATUS_COLORS: Record<ReauthLoanStatus, { color: string; bg: string; border: string; dot: string }> = {
  REAUTH_REQUIRED:            { color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  REAUTH_IN_PROGRESS:         { color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6' },
  REAUTH_FAILED:              { color: '#881337', bg: '#FFF1F2', border: '#FECDD3', dot: '#DC2626' },
  REAUTH_COMPLETED:           { color: '#14532D', bg: '#F0FDF4', border: '#86EFAC', dot: '#16A34A' },
  PENDING_APPROVAL:           { color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  PENDING_MANAGER_APPROVAL:   { color: '#1E3A5F', bg: '#EFF6FF', border: '#93C5FD', dot: '#2563EB' },
  PENDING_MASTER_APPROVAL:    { color: '#4C1D95', bg: '#F5F3FF', border: '#C4B5FD', dot: '#7C3AED' },
  APPROVAL_APPROVED:          { color: '#064E3B', bg: '#ECFDF5', border: '#6EE7B7', dot: '#10B981' },
  APPROVAL_REJECTED:          { color: '#450A0A', bg: '#FEF2F2', border: '#FCA5A5', dot: '#B91C1C' },
  DISBURSEMENT_BLOCKED:       { color: '#7C2D12', bg: '#FFF7ED', border: '#FDBA74', dot: '#F97316' },
  READY_FOR_DISBURSEMENT:     { color: '#064E3B', bg: '#ECFDF5', border: '#6EE7B7', dot: '#10B981' },
}

export const APPROVAL_MODE_LABELS: Record<ApprovalMode, string> = {
  sequential:     'Secuencial',
  parallel:       'Paralelo',
  all_required:   'Todos requeridos',
  minimum_count:  'Mínimo N aprobaciones',
}

export const BIOMETRIC_MODE_LABELS: Record<BiometricMode, string> = {
  face_only:        'Solo rostro (Face ID)',
  fingerprint_only: 'Solo huella digital',
  either:           'Cualquiera (rostro o huella)',
}

export const SCOPE_TYPE_LABELS: Record<ThresholdScopeType, string> = {
  global:     'Global',
  branch:     'Por sucursal',
  product:    'Por producto',
  agent_role: 'Por rol de agente',
  agent:      'Por agente específico',
}
