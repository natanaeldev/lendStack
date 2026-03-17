// POST /api/loans/[id]/modifications/[modId]/cancel
// Transitions DRAFT | PENDING_APPROVAL | APPROVED → CANCELLED.
// Any authenticated user can cancel (the submitter owns the draft).
// Body: { reason?: string }

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { cancelModification }                from '@/lib/restructure/service'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; modId: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

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

    await cancelModification(db, params.modId, session.user.organizationId, actor, body.reason)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/modifications/[modId]/cancel]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
