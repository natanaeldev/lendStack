// GET /api/loans/[id]/schedule-versions
// Returns all immutable schedule versions for a loan.
// v1 = original schedule captured on first booking.
// v2, v3, … = each booked modification.

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { listScheduleVersions }              from '@/lib/restructure/service'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db       = await getDb()
    const orgId    = session.user.organizationId

    // Verify loan belongs to this org
    const loan = await db.collection('loans').findOne(
      { _id: params.id as any, organizationId: orgId },
      { projection: { _id: 1 } },
    )
    if (!loan) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })

    const versions = await listScheduleVersions(db, params.id, orgId)
    return NextResponse.json({ versions })
  } catch (err: any) {
    console.error('[GET /api/loans/[id]/schedule-versions]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
