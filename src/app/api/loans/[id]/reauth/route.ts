// ─── POST /api/loans/[id]/reauth — start a reauth session ────────────────────
// Also GET to retrieve current session status

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { startReauthSession, getSessionByLoanId } from '@/lib/loanReauth/service'
import { resolveApprovalPolicy }             from '@/lib/loanReauth/threshold'
import { ensureReauthIndexes }               from '@/lib/loanReauth/indexes'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db     = await getDb()
    const orgId  = session.user.organizationId
    const reauth = await getSessionByLoanId(db, orgId, params.id)
    return NextResponse.json({ session: reauth })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export async function POST(
  req: NextRequest,
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

    if (!loan.requiresReauth) {
      return NextResponse.json({ error: 'Este préstamo no requiere reautorización' }, { status: 400 })
    }

    if (loan.reauthStatus && loan.reauthStatus !== 'REAUTH_REQUIRED') {
      return NextResponse.json({ error: `Reautorización ya iniciada (estado: ${loan.reauthStatus})` }, { status: 400 })
    }

    // Resolve approval policy to get retry limit
    const approvalPolicy = await resolveApprovalPolicy(db, {
      organizationId: orgId,
      agentId:    session.user.id,
      agentRole:  session.user.role ?? 'user',
      amount:     loan.amount,
      currency:   loan.currency,
    })

    const reauthSession = await startReauthSession(
      db,
      {
        organizationId: orgId,
        loanId:         params.id,
        customerId:     String(loan.clientId),
        agentId:        session.user.id,
        policyId:       approvalPolicy?._id ?? loan.triggeredPolicyId ?? 'default',
        maxRetries:     approvalPolicy?.retryLimit ?? 3,
      },
      { actorId: session.user.id, actorRole: session.user.role ?? 'user' },
    )

    return NextResponse.json({ success: true, session: reauthSession })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/reauth]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
