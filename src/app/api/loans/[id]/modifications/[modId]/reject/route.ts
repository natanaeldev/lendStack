// POST /api/loans/[id]/modifications/[modId]/reject
// Transitions PENDING_APPROVAL → REJECTED.
// Body: { reason: string }  (required)
// Requires: same permissions as approve

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { rejectModification }                from '@/lib/restructure/service'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; modId: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  const canReject =
    session.user.role === 'master' ||
    session.user.isOrganizationOwner ||
    session.user.organizationRole === 'MANAGER'

  if (!canReject) {
    return NextResponse.json(
      { error: 'No tiene permisos para rechazar modificaciones. Se requiere rol de Manager o superior.' },
      { status: 403 },
    )
  }

  try {
    const body = await req.json()
    if (!body.reason?.trim()) {
      return NextResponse.json({ error: 'Se requiere reason para rechazar una modificación.' }, { status: 400 })
    }

    const db = await getDb()

    const userDoc = await db.collection('users').findOne(
      { email: session.user.email },
      { projection: { name: 1, role: 1 } },
    )

    const actor = {
      id:   session.user.id,
      name: session.user.name ?? userDoc?.name ?? session.user.email ?? 'Desconocido',
      role: session.user.role ?? session.user.organizationRole ?? 'user',
    }

    await rejectModification(db, params.modId, session.user.organizationId, actor, body.reason.trim())
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/modifications/[modId]/reject]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
