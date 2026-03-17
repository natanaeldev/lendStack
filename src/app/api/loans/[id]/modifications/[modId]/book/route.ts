// POST /api/loans/[id]/modifications/[modId]/book
// Transitions APPROVED → BOOKED.
// This is the critical path: supersedes installments, inserts new schedule,
// updates the loan record, and captures an immutable schedule version.
// Requires: same permissions as approve (manager+)

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { bookModification }                  from '@/lib/restructure/service'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; modId: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  const canBook =
    session.user.role === 'master' ||
    session.user.isOrganizationOwner ||
    session.user.organizationRole === 'MANAGER'

  if (!canBook) {
    return NextResponse.json(
      { error: 'No tiene permisos para aplicar modificaciones. Se requiere rol de Manager o superior.' },
      { status: 403 },
    )
  }

  try {
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

    await bookModification(db, params.modId, session.user.organizationId, actor)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/modifications/[modId]/book]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
