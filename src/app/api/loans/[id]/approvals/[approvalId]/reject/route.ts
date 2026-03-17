// ─── POST /api/loans/[id]/approvals/[approvalId]/reject ──────────────────────
// Reject a specific approval task. Comments are required.

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { rejectTask }                        from '@/lib/loanReauth/approvalEngine'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; approvalId: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  const canReject =
    session.user.role === 'master' ||
    session.user.isOrganizationOwner ||
    session.user.role === 'manager' ||
    session.user.organizationRole?.toUpperCase() === 'MANAGER'

  if (!canReject) {
    return NextResponse.json(
      { error: 'No tiene permisos para rechazar. Se requiere rol de Gerente o superior.' },
      { status: 403 },
    )
  }

  try {
    const body = await req.json()
    const { comments } = body

    if (!comments?.trim()) {
      return NextResponse.json({ error: 'Se requiere un comentario para rechazar.' }, { status: 400 })
    }

    const db = await getDb()
    await rejectTask(
      db,
      {
        organizationId: session.user.organizationId,
        loanId:         params.id,
        approvalTaskId: params.approvalId,
        approverId:     session.user.id,
        approverRole:   session.user.role ?? session.user.organizationRole ?? 'user',
        comments,
      },
      { actorId: session.user.id, actorRole: session.user.role ?? 'user' },
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/approvals/[approvalId]/reject]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
