// POST /api/loans/[id]/modifications/[modId]/approve
// Transitions PENDING_APPROVAL → APPROVED.
// Requires: isOrganizationOwner OR role === 'master' OR organizationRole === 'MANAGER'

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { approveModification }               from '@/lib/restructure/service'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; modId: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  // Only owners, masters, and managers can approve
  const canApprove =
    session.user.role === 'master' ||
    session.user.isOrganizationOwner ||
    session.user.organizationRole === 'MANAGER'

  if (!canApprove) {
    return NextResponse.json(
      { error: 'No tiene permisos para aprobar modificaciones. Se requiere rol de Manager o superior.' },
      { status: 403 },
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const db   = await getDb()

    const userDoc = await db.collection('users').findOne(
      { email: session.user.email },
      { projection: { name: 1, role: 1 } },
    )

    const actor = {
      id:   session.user.id,
      name: session.user.name ?? userDoc?.name ?? session.user.email ?? 'Desconocido',
      role: session.user.role ?? session.user.organizationRole ?? 'user',
    }

    await approveModification(db, params.modId, session.user.organizationId, actor, body.reviewNotes)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/modifications/[modId]/approve]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
