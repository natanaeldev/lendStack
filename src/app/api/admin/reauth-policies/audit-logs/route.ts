// ─── GET /api/admin/reauth-policies/audit-logs ───────────────────────────────
// Returns admin policy change audit log.

import { NextRequest, NextResponse }         from 'next/server'
import { getDb, isDbConfigured }            from '@/lib/mongodb'
import { requireMaster, forbiddenResponse } from '@/lib/orgAuth'

export async function GET(req: NextRequest) {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const { searchParams } = new URL(req.url)
    const policyType = searchParams.get('policyType')
    const limit      = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))

    const db    = await getDb()
    const query: Record<string, any> = { organizationId: session.user.organizationId }
    if (policyType) query.policyType = policyType

    const logs = await db
      .collection('admin_policy_change_logs')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    return NextResponse.json({ logs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
