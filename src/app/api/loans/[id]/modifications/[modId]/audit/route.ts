// GET /api/loans/[id]/modifications/[modId]/audit
// Returns the full immutable audit trail for a modification.

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { getAuditTrail }                     from '@/lib/restructure/audit'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; modId: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db    = await getDb()
    const trail = await getAuditTrail(db, params.modId, session.user.organizationId)
    return NextResponse.json({ auditTrail: trail })
  } catch (err: any) {
    console.error('[GET /api/loans/[id]/modifications/[modId]/audit]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
