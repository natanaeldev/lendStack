import { NextResponse }                       from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'

// ─── GET /api/org — returns current org plan + limits ─────────────────────────
export async function GET() {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db  = await getDb()
    const org = await db.collection('organizations').findOne({
      _id: session.user.organizationId as any,
    })

    const plan = (org?.plan as string | undefined) ?? 'starter'

    // Count clients for limit display
    const clientCount = await db.collection('clients').countDocuments({
      organizationId: session.user.organizationId,
    })

    const limits = {
      starter: { maxClients: 50 },
      pro:     { maxClients: Infinity },
      enterprise: { maxClients: Infinity },
    }
    const maxClients = (limits[plan as keyof typeof limits] ?? limits.starter).maxClients

    return NextResponse.json({
      orgId:        String(org?._id ?? session.user.organizationId),
      orgName:      (org?.name as string | undefined) ?? '',
      plan,
      clientCount,
      maxClients:   maxClients === Infinity ? null : maxClients,
      isAtLimit:    maxClients !== Infinity && clientCount >= maxClients,
      isNearLimit:  maxClients !== Infinity && clientCount >= maxClients * 0.8,
    })
  } catch (err: any) {
    console.error('[GET /api/org]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
