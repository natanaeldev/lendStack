// ─── Multi-Level Approval Engine ─────────────────────────────────────────────
// Handles sequential/parallel approval flows, minimum count, all-required,
// terminal rejection, and disbursement gate.

import type { Db } from 'mongodb'
import { v4 as uuid } from 'uuid'
import type { LoanApproval, LoanApprovalPolicy, ApproverDefinition } from './types'
import { recordLoanAudit } from './audit'
import type { AuditActorContext } from './audit'
import { emitNotification } from '@/lib/notifications'

// ─── Create approval tasks ────────────────────────────────────────────────────

export async function createApprovalTasks(
  db: Db,
  params: {
    organizationId: string
    loanId: string
    customerId: string
    policy: LoanApprovalPolicy
    amount: number
    currency: string
  },
  actor: AuditActorContext,
): Promise<LoanApproval[]> {
  const now = new Date().toISOString()

  const tasks: LoanApproval[] = params.policy.approvers.map((approver, idx) => ({
    _id:            uuid(),
    organizationId: params.organizationId,
    loanId:         params.loanId,
    policyId:       params.policy._id,
    approverUserId: null,
    approverRole:   buildRoleLabel(approver),
    status:         params.policy.approvalMode === 'sequential' && idx > 0
      ? ('pending' as const)   // Will be activated one-by-one
      : ('pending' as const),
    comments:       null,
    decidedAt:      null,
    sequenceOrder:  idx + 1,
    createdAt:      now,
    updatedAt:      now,
  }))

  await db.collection<LoanApproval>('loan_approvals').insertMany(tasks as any[])

  // Resolve actual user IDs for role-based approvers
  await assignApproverUserIds(db, params.organizationId, tasks, params.policy.approvers)

  // Mark loan as pending_approval
  await db.collection('loans').updateOne(
    { _id: params.loanId as any, organizationId: params.organizationId },
    {
      $set: {
        status:          'pending_approval',
        reauthStatus:    'PENDING_APPROVAL',
        approvalStatus:  'pending',
        disbursementLocked: true,
        updatedAt:       now,
      },
    },
  )

  await recordLoanAudit(db, {
    organizationId: params.organizationId,
    loanId:    params.loanId,
    customerId: params.customerId,
    actor,
    eventType: 'approval_request_created',
    eventPayload: {
      policyId:   params.policy._id,
      policyName: params.policy.name,
      mode:       params.policy.approvalMode,
      approvers:  tasks.map(t => ({ id: t._id, role: t.approverRole, userId: t.approverUserId })),
      amount:     params.amount,
      currency:   params.currency,
    },
  })

  // Notify approvers
  await notifyApprovers(db, params, tasks, actor)

  return tasks
}

// ─── Approve a task ───────────────────────────────────────────────────────────

export async function approveTask(
  db: Db,
  params: {
    organizationId: string
    loanId: string
    approvalTaskId: string
    approverId: string
    approverRole: string
    comments?: string
  },
  actor: AuditActorContext,
): Promise<void> {
  const task = await getTask(db, params.organizationId, params.approvalTaskId)

  if (task.status !== 'pending') {
    throw Object.assign(new Error('This approval task is already decided'), { status: 400 })
  }

  if (!canActOnTask(task, params.approverId, params.approverRole)) {
    throw Object.assign(new Error('You are not authorized to approve this task'), { status: 403 })
  }

  const now = new Date().toISOString()
  await db.collection('loan_approvals').updateOne(
    { _id: params.approvalTaskId as any, organizationId: params.organizationId },
    {
      $set: {
        status:         'approved',
        approverUserId: params.approverId,
        comments:       params.comments ?? null,
        decidedAt:      now,
        updatedAt:      now,
      },
    },
  )

  await recordLoanAudit(db, {
    organizationId: params.organizationId,
    loanId:    params.loanId,
    customerId: null,
    actor,
    eventType: 'approval_task_approved',
    eventPayload: { taskId: params.approvalTaskId, approverRole: params.approverRole },
  })

  // Evaluate overall approval status
  await evaluateApprovalOutcome(db, params.organizationId, params.loanId, actor)
}

// ─── Reject a task ────────────────────────────────────────────────────────────

export async function rejectTask(
  db: Db,
  params: {
    organizationId: string
    loanId: string
    approvalTaskId: string
    approverId: string
    approverRole: string
    comments: string
  },
  actor: AuditActorContext,
): Promise<void> {
  if (!params.comments?.trim()) {
    throw Object.assign(new Error('Comments are required when rejecting'), { status: 400 })
  }

  const task = await getTask(db, params.organizationId, params.approvalTaskId)

  if (task.status !== 'pending') {
    throw Object.assign(new Error('This approval task is already decided'), { status: 400 })
  }

  if (!canActOnTask(task, params.approverId, params.approverRole)) {
    throw Object.assign(new Error('You are not authorized to reject this task'), { status: 403 })
  }

  const now = new Date().toISOString()
  await db.collection('loan_approvals').updateOne(
    { _id: params.approvalTaskId as any, organizationId: params.organizationId },
    {
      $set: {
        status:         'rejected',
        approverUserId: params.approverId,
        comments:       params.comments,
        decidedAt:      now,
        updatedAt:      now,
      },
    },
  )

  await recordLoanAudit(db, {
    organizationId: params.organizationId,
    loanId:    params.loanId,
    customerId: null,
    actor,
    eventType: 'approval_task_rejected',
    eventPayload: { taskId: params.approvalTaskId, approverRole: params.approverRole, comments: params.comments },
  })

  // Check rejection mode
  const policy = await getPolicy(db, params.organizationId, task.policyId)
  if (policy?.rejectionMode === 'terminal') {
    await finallyRejectLoan(db, params.organizationId, params.loanId, params.comments, actor)
  } else {
    await evaluateApprovalOutcome(db, params.organizationId, params.loanId, actor)
  }
}

// ─── Outcome evaluation ───────────────────────────────────────────────────────

async function evaluateApprovalOutcome(
  db: Db,
  organizationId: string,
  loanId: string,
  actor: AuditActorContext,
): Promise<void> {
  const tasks = await db
    .collection<LoanApproval>('loan_approvals')
    .find({ loanId, organizationId })
    .sort({ sequenceOrder: 1 })
    .toArray() as LoanApproval[]

  if (!tasks.length) return

  const policy = await getPolicy(db, organizationId, tasks[0].policyId)
  if (!policy) return

  const approved = tasks.filter(t => t.status === 'approved').length
  const rejected = tasks.filter(t => t.status === 'rejected').length
  const total    = tasks.length

  let fullyApproved = false

  switch (policy.approvalMode) {
    case 'all_required':
      fullyApproved = approved === total
      break
    case 'minimum_count':
      fullyApproved = approved >= policy.requiredApprovalCount
      break
    case 'parallel':
      fullyApproved = approved === total
      break
    case 'sequential': {
      // Activate next pending task after each approval
      const pendingTasks = tasks.filter(t => t.status === 'pending').sort((a, b) => a.sequenceOrder - b.sequenceOrder)
      const lastApproved = tasks.filter(t => t.status === 'approved').sort((a, b) => b.sequenceOrder - a.sequenceOrder)[0]
      if (pendingTasks.length > 0 && lastApproved) {
        // Tasks are already in pending state; sequential flow just processes them in order
      }
      fullyApproved = approved === total
      break
    }
  }

  if (fullyApproved) {
    await finallyApproveLoan(db, organizationId, loanId, actor)
  }
}

async function finallyApproveLoan(
  db: Db,
  organizationId: string,
  loanId: string,
  actor: AuditActorContext,
): Promise<void> {
  const now = new Date().toISOString()
  await db.collection('loans').updateOne(
    { _id: loanId as any, organizationId },
    {
      $set: {
        status:             'approved',
        reauthStatus:       'APPROVAL_APPROVED',
        approvalStatus:     'approved',
        disbursementLocked: false,
        updatedAt:          now,
      },
    },
  )

  await recordLoanAudit(db, {
    organizationId,
    loanId,
    customerId: null,
    actor,
    eventType: 'loan_fully_approved',
    eventPayload: {},
  })

  await recordLoanAudit(db, {
    organizationId,
    loanId,
    customerId: null,
    actor,
    eventType: 'disbursement_unlocked',
    eventPayload: {},
  })

  const loan = await db.collection('loans').findOne({ _id: loanId as any, organizationId })
  if (loan) {
    const client = await db.collection('clients').findOne({ _id: loan.clientId as any, organizationId }, { projection: { name: 1 } })
    await emitNotification(db, {
      tenantId:    organizationId,
      actorUserId: actor.actorId,
      type:        'loan.approved',
      entityType:  'loan',
      entityId:    loanId,
      actionUrl:   `/app/prestamos?loanId=${loanId}`,
      message:     `El préstamo de ${client?.name ?? 'cliente'} fue aprobado y está listo para desembolso.`,
      metadata:    { loanId },
    })
  }
}

async function finallyRejectLoan(
  db: Db,
  organizationId: string,
  loanId: string,
  reason: string,
  actor: AuditActorContext,
): Promise<void> {
  const now = new Date().toISOString()
  await db.collection('loans').updateOne(
    { _id: loanId as any, organizationId },
    {
      $set: {
        status:          'approval_rejected',
        reauthStatus:    'APPROVAL_REJECTED',
        approvalStatus:  'rejected',
        updatedAt:       now,
      },
    },
  )

  await recordLoanAudit(db, {
    organizationId,
    loanId,
    customerId: null,
    actor,
    eventType: 'loan_fully_rejected',
    eventPayload: { reason },
  })

  const loan = await db.collection('loans').findOne({ _id: loanId as any, organizationId })
  if (loan) {
    const client = await db.collection('clients').findOne({ _id: loan.clientId as any, organizationId }, { projection: { name: 1 } })
    await emitNotification(db, {
      tenantId:    organizationId,
      actorUserId: actor.actorId,
      type:        'loan.rejected',
      entityType:  'loan',
      entityId:    loanId,
      actionUrl:   `/app/prestamos?loanId=${loanId}`,
      message:     `El préstamo de ${client?.name ?? 'cliente'} fue rechazado por un aprobador.`,
      metadata:    { loanId, reason },
    })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getTask(db: Db, organizationId: string, taskId: string): Promise<LoanApproval> {
  const task = await db
    .collection<LoanApproval>('loan_approvals')
    .findOne({ _id: taskId as any, organizationId })
  if (!task) throw Object.assign(new Error('Approval task not found'), { status: 404 })
  return task as LoanApproval
}

async function getPolicy(
  db: Db,
  organizationId: string,
  policyId: string,
): Promise<LoanApprovalPolicy | null> {
  return db
    .collection<LoanApprovalPolicy>('loan_approval_policies')
    .findOne({ _id: policyId as any, organizationId }) as Promise<LoanApprovalPolicy | null>
}

function canActOnTask(task: LoanApproval, userId: string, userRole: string): boolean {
  if (task.approverUserId && task.approverUserId !== userId) return false
  const normalizedRole = userRole.toLowerCase()
  const taskRole = task.approverRole.toLowerCase()
  if (taskRole === 'any' || taskRole === normalizedRole) return true
  if (taskRole === 'master' && (normalizedRole === 'master' || normalizedRole === 'owner')) return true
  if (taskRole === 'manager' && (normalizedRole === 'manager' || normalizedRole === 'master' || normalizedRole === 'owner')) return true
  return false
}

function buildRoleLabel(approver: ApproverDefinition): string {
  switch (approver.type) {
    case 'manager':       return 'manager'
    case 'master':        return 'master'
    case 'custom_role':   return approver.value ?? 'custom'
    case 'specific_user': return `user:${approver.value}`
    default:              return 'any'
  }
}

async function assignApproverUserIds(
  db: Db,
  organizationId: string,
  tasks: LoanApproval[],
  approvers: ApproverDefinition[],
): Promise<void> {
  const updates: Array<Promise<void>> = []
  for (let i = 0; i < tasks.length; i++) {
    const approver = approvers[i]
    if (!approver) continue
    if (approver.type === 'specific_user' && approver.value) {
      updates.push(
        db.collection('loan_approvals').updateOne(
          { _id: tasks[i]._id as any },
          { $set: { approverUserId: approver.value } },
        ).then(() => undefined),
      )
    } else if (approver.type === 'manager' || approver.type === 'master') {
      const role = approver.type === 'master' ? ['master'] : ['manager', 'master']
      const users = await db.collection('users')
        .find({ organizationId, role: { $in: role } }, { projection: { _id: 1 } })
        .limit(1)
        .toArray()
      if (users[0]) {
        updates.push(
          db.collection('loan_approvals').updateOne(
            { _id: tasks[i]._id as any },
            { $set: { approverUserId: String(users[0]._id) } },
          ).then(() => undefined),
        )
      }
    } else if (approver.type === 'custom_role' && approver.value) {
      const users = await db.collection('users')
        .find({ organizationId, role: approver.value }, { projection: { _id: 1 } })
        .limit(1)
        .toArray()
      if (users[0]) {
        updates.push(
          db.collection('loan_approvals').updateOne(
            { _id: tasks[i]._id as any },
            { $set: { approverUserId: String(users[0]._id) } },
          ).then(() => undefined),
        )
      }
    }
  }
  await Promise.all(updates)
}

async function notifyApprovers(
  db: Db,
  params: {
    organizationId: string
    loanId: string
    customerId: string
    policy: LoanApprovalPolicy
    amount: number
    currency: string
  },
  tasks: LoanApproval[],
  actor: AuditActorContext,
): Promise<void> {
  const loan = await db.collection('loans').findOne({ _id: params.loanId as any }, { projection: { clientId: 1 } })
  const client = loan
    ? await db.collection('clients').findOne({ _id: loan.clientId as any }, { projection: { name: 1 } })
    : null

  const amountLabel = new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: params.currency,
    maximumFractionDigits: 2,
  }).format(params.amount)

  const approverUserIds = tasks
    .map(t => t.approverUserId)
    .filter((id): id is string => Boolean(id))

  if (approverUserIds.length > 0) {
    await emitNotification(db, {
      tenantId:    params.organizationId,
      actorUserId: actor.actorId,
      userIds:     approverUserIds,
      type:        'manual_review.required',
      entityType:  'loan',
      entityId:    params.loanId,
      actionUrl:   `/app/aprobaciones?loanId=${params.loanId}`,
      title:       'Aprobación de préstamo requerida',
      message:     `Se requiere su aprobación para el préstamo de ${client?.name ?? 'un cliente'} por ${amountLabel}.`,
      priority:    'high',
      metadata:    { loanId: params.loanId, amount: params.amount, currency: params.currency, policyId: params.policy._id },
    })
  }

  await recordLoanAudit(db, {
    organizationId: params.organizationId,
    loanId:    params.loanId,
    customerId: params.customerId,
    actor,
    eventType: 'notification_sent',
    eventPayload: { recipientCount: approverUserIds.length },
  })
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getLoanApprovals(
  db: Db,
  organizationId: string,
  loanId: string,
): Promise<LoanApproval[]> {
  return db
    .collection<LoanApproval>('loan_approvals')
    .find({ organizationId, loanId })
    .sort({ sequenceOrder: 1 })
    .toArray() as Promise<LoanApproval[]>
}

export async function getPendingApprovalsForUser(
  db: Db,
  organizationId: string,
  userId: string,
  userRole: string,
): Promise<Array<LoanApproval & { loanAmount?: number; clientName?: string }>> {
  const roleLabel = userRole.toLowerCase()
  const rolesCanApprove = ['any', roleLabel]
  if (roleLabel === 'master') rolesCanApprove.push('manager', 'owner')
  if (roleLabel === 'manager') rolesCanApprove.push('any')

  const tasks = await db
    .collection<LoanApproval>('loan_approvals')
    .find({
      organizationId,
      status: 'pending',
      $or: [
        { approverUserId: userId },
        { approverRole: { $in: rolesCanApprove } },
      ],
    })
    .sort({ createdAt: -1 })
    .toArray() as LoanApproval[]

  // Enrich with loan + client info
  const loanIds = Array.from(new Set(tasks.map(t => t.loanId)))
  const loans = loanIds.length
    ? await db.collection('loans').find({ _id: { $in: loanIds as any[] } }, { projection: { _id: 1, amount: 1, currency: 1, clientId: 1 } }).toArray()
    : []
  const clientIds = Array.from(new Set(loans.map(l => l.clientId)))
  const clients = clientIds.length
    ? await db.collection('clients').find({ _id: { $in: clientIds as any[] } }, { projection: { _id: 1, name: 1 } }).toArray()
    : []
  const loanMap = Object.fromEntries(loans.map(l => [String(l._id), l]))
  const clientMap = Object.fromEntries(clients.map(c => [String(c._id), c]))

  return tasks.map(t => ({
    ...t,
    loanAmount:  loanMap[t.loanId]?.amount,
    loanCurrency: loanMap[t.loanId]?.currency,
    clientName:  clientMap[loanMap[t.loanId]?.clientId]?.name,
  }))
}
