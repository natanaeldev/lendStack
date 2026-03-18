// ─── GET /api/approvals — approver inbox ─────────────────────────────────────
// Returns all pending approval tasks for the current user.

import { NextResponse }                      from 'next/server'
import { getDb, isDbConfigured }            from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { getPendingApprovalsForUser }        from '@/lib/loanReauth/approvalEngine'

export async function GET() {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false, approvals: [] }, { status: 503 })

  const canApprove =
    session.user.role === 'master' ||
    session.user.isOrganizationOwner ||
    session.user.role === 'manager' ||
    session.user.organizationRole?.toUpperCase() === 'MANAGER'

  if (!canApprove) {
    return NextResponse.json({ approvals: [] })
  }

  try {
    const db       = await getDb()
    const approvals = await getPendingApprovalsForUser(
      db,
      session.user.organizationId,
      session.user.id,
      session.user.role ?? session.user.organizationRole ?? 'user',
    )
    return NextResponse.json({ approvals })
  } catch (err: any) {
    console.error('[GET /api/approvals]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
