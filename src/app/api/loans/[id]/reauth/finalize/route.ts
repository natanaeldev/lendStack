// ─── POST /api/loans/[id]/reauth/finalize ────────────────────────────────────
// Finalizes the reauth session and automatically submits for approval.
// Body: { sessionId }

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { finalizeReauthSession }             from '@/lib/loanReauth/service'
import { createApprovalTasks }               from '@/lib/loanReauth/approvalEngine'
import { resolveApprovalPolicy }             from '@/lib/loanReauth/threshold'
import { ensureReauthIndexes }               from '@/lib/loanReauth/indexes'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body = await req.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId es requerido' }, { status: 400 })
    }

    const db    = await getDb()
    const orgId = session.user.organizationId
    await ensureReauthIndexes(db)

    const updatedSession = await finalizeReauthSession(
      db,
      { organizationId: orgId, sessionId },
      { actorId: session.user.id, actorRole: session.user.role ?? 'user' },
    )

    // Automatically submit for approval after successful reauth
    const loan = await db.collection('loans').findOne({
      _id:            params.id as any,
      organizationId: orgId,
    })

    if (!loan) {
      return NextResponse.json({ success: true, session: updatedSession, approvalSubmitted: false })
    }

    if (loan.approvalStatus === 'pending') {
      // Already submitted — return success without re-submitting
      return NextResponse.json({ success: true, session: updatedSession, approvalSubmitted: false, reason: 'already_pending' })
    }

    const approvalPolicy = await resolveApprovalPolicy(db, {
      organizationId: orgId,
      agentId:   session.user.id,
      agentRole: session.user.role ?? 'user',
      amount:    Number(loan.amount),
      currency:  String(loan.currency),
    })

    if (!approvalPolicy) {
      // No policy found — finalize succeeded but approval cannot be auto-submitted
      return NextResponse.json({
        success:           true,
        session:           updatedSession,
        approvalSubmitted: false,
        reason:            'no_approval_policy',
      })
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

    return NextResponse.json({
      success:           true,
      session:           updatedSession,
      approvalSubmitted: true,
      approvalTasks:     tasks.length,
      policyName:        approvalPolicy.name,
    })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/reauth/finalize]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
