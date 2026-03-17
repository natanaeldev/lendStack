// GET /api/loans/[id]/modifications/[modId]
// Returns a single modification with its embedded simulation result.

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { getModification }                   from '@/lib/restructure/service'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; modId: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db  = await getDb()
    const mod = await getModification(db, params.modId, session.user.organizationId)

    if (!mod || mod.loanId !== params.id) {
      return NextResponse.json({ error: 'Modificación no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ modification: mod })
  } catch (err: any) {
    console.error('[GET /api/loans/[id]/modifications/[modId]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
