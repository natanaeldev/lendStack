// POST /api/loans/[id]/modifications/[modId]/submit
// Transitions DRAFT → PENDING_APPROVAL.
// Any authenticated user can submit their own draft.
// Blocked if eligibility violations exist (policy must be satisfied).

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { submitModification }                from '@/lib/restructure/service'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; modId: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db    = await getDb()
    const orgId = session.user.organizationId

    const userDoc = await db.collection('users').findOne(
      { email: session.user.email },
      { projection: { name: 1, role: 1 } },
    )

    const actor = {
      id:   session.user.id,
      name: session.user.name ?? userDoc?.name ?? session.user.email ?? 'Desconocido',
      role: session.user.role ?? 'user',
    }

    await submitModification(db, params.modId, orgId, actor)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/modifications/[modId]/submit]', err)
    return NextResponse.json(
      { error: err.message, violations: err.violations ?? undefined },
      { status: err.status ?? 500 },
    )
  }
}
