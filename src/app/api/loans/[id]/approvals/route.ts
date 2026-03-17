// ─── GET /api/loans/[id]/approvals ───────────────────────────────────────────
// Returns all approval tasks for a loan along with audit trail.

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { getLoanApprovals }                  from '@/lib/loanReauth/approvalEngine'
import { getLoanAuditTrail }                 from '@/lib/loanReauth/audit'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db    = await getDb()
    const orgId = session.user.organizationId

    const loan = await db.collection('loans').findOne(
      { _id: params.id as any, organizationId: orgId },
      { projection: { _id: 1, status: 1, reauthStatus: 1, approvalStatus: 1, disbursementLocked: 1, requiresReauth: 1, amount: 1, currency: 1, clientId: 1 } },
    )
    if (!loan) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })

    const [approvals, auditLogs] = await Promise.all([
      getLoanApprovals(db, orgId, params.id),
      getLoanAuditTrail(db, orgId, params.id),
    ])

    // Enrich approvals with approver name
    const approverIds = approvals.map(a => a.approverUserId).filter(Boolean)
    const approverUsers = approverIds.length
      ? await db.collection('users').find({ _id: { $in: approverIds as any[] } }, { projection: { _id: 1, name: 1, role: 1 } }).toArray()
      : []
    const approverMap = Object.fromEntries(approverUsers.map(u => [String(u._id), u]))

    const enrichedApprovals = approvals.map(a => ({
      ...a,
      approverName: a.approverUserId ? (approverMap[a.approverUserId]?.name ?? null) : null,
    }))

    return NextResponse.json({
      loan: {
        _id:              String(loan._id),
        status:           loan.status,
        reauthStatus:     loan.reauthStatus,
        approvalStatus:   loan.approvalStatus,
        disbursementLocked: loan.disbursementLocked,
        requiresReauth:   loan.requiresReauth,
        amount:           loan.amount,
        currency:         loan.currency,
      },
      approvals:  enrichedApprovals,
      auditLogs,
    })
  } catch (err: any) {
    console.error('[GET /api/loans/[id]/approvals]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
