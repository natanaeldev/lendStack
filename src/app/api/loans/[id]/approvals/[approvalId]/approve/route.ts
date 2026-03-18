// ─── POST /api/loans/[id]/approvals/[approvalId]/approve ─────────────────────
// Approve a specific approval task.

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { approveTask }                       from '@/lib/loanReauth/approvalEngine'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; approvalId: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  // Only managers, masters/owners can approve
  const canApprove =
    session.user.role === 'master' ||
    session.user.isOrganizationOwner ||
    session.user.role === 'manager' ||
    session.user.organizationRole?.toUpperCase() === 'MANAGER'

  if (!canApprove) {
    return NextResponse.json(
      { error: 'No tiene permisos para aprobar. Se requiere rol de Gerente o superior.' },
      { status: 403 },
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const db   = await getDb()

    await approveTask(
      db,
      {
        organizationId: session.user.organizationId,
        loanId:         params.id,
        approvalTaskId: params.approvalId,
        approverId:     session.user.id,
        approverRole:   session.user.role ?? session.user.organizationRole ?? 'user',
        comments:       body.comments,
      },
      { actorId: session.user.id, actorRole: session.user.role ?? 'user' },
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/approvals/[approvalId]/approve]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
