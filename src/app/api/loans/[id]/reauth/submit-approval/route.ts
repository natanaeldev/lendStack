// ─── POST /api/loans/[id]/reauth/submit-approval ─────────────────────────────
// After successful reauth, submit the loan for approval.
// Creates approval tasks and notifies approvers.

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { createApprovalTasks }               from '@/lib/loanReauth/approvalEngine'
import { resolveApprovalPolicy }             from '@/lib/loanReauth/threshold'
import { ensureReauthIndexes }               from '@/lib/loanReauth/indexes'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db    = await getDb()
    const orgId = session.user.organizationId
    await ensureReauthIndexes(db)

    const loan = await db.collection('loans').findOne({
      _id:            params.id as any,
      organizationId: orgId,
    })
    if (!loan) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })

    if (loan.status !== 'reauth_completed') {
      return NextResponse.json(
        { error: `El préstamo debe completar la reautorización antes de enviarlo a aprobación (estado actual: ${loan.status})` },
        { status: 400 },
      )
    }

    if (loan.approvalStatus === 'pending') {
      return NextResponse.json({ error: 'El préstamo ya fue enviado para aprobación' }, { status: 400 })
    }

    let approvalPolicy = await resolveApprovalPolicy(db, {
      organizationId: orgId,
      agentId:    session.user.id,
      agentRole:  session.user.role ?? 'user',
      amount:     Number(loan.amount),
      currency:   String(loan.currency),
    })

    if (!approvalPolicy) {
      // No policy configured in DB — use a safe hardcoded fallback.
      const now2 = new Date().toISOString()
      approvalPolicy = {
        _id:                   'fallback_default',
        organizationId:        orgId,
        name:                  'Aprobación predeterminada (sin política configurada)',
        active:                true,
        scopeType:             'global',
        scopeId:               null,
        minAmount:             0,
        maxAmount:             null,
        currency:              String(loan.currency),
        approvalMode:          'all_required',
        requiredApprovalCount: 1,
        rejectionMode:         'terminal',
        approvers:             [{ type: 'manager' }],
        biometricMode:         'either',
        retryLimit:            3,
        notificationChannels:  ['inApp'],
        secondThresholdAmount: null,
        createdAt:             now2,
        updatedAt:             now2,
        createdBy:             'system_fallback',
      }
    }

    const tasks = await createApprovalTasks(
      db,
      {
        organizationId: orgId,
        loanId:     params.id,
        customerId: String(loan.clientId),
        policy:     approvalPolicy,
        amount:     Number(loan.amount),
        currency:   String(loan.currency),
      },
      { actorId: session.user.id, actorRole: session.user.role ?? 'user' },
    )

    return NextResponse.json({ success: true, approvalTasks: tasks.length, policyName: approvalPolicy.name })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/reauth/submit-approval]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
