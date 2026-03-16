import { NextRequest, NextResponse } from 'next/server'
import { getDb, isDbConfigured } from '@/lib/mongodb'
import { listNotifications, type NotificationCategory } from '@/lib/notifications'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'

const VALID_CATEGORIES = new Set(['all', 'loan', 'payment', 'document', 'compliance', 'review', 'system'])
const VALID_STATES = new Set(['all', 'read', 'unread'])

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false, items: [] }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') ?? '1')
    const pageSize = Number(searchParams.get('pageSize') ?? '20')
    const categoryRaw = searchParams.get('category') ?? 'all'
    const stateRaw = searchParams.get('state') ?? 'all'
    const category = (VALID_CATEGORIES.has(categoryRaw) ? categoryRaw : 'all') as NotificationCategory | 'all'
    const state = (VALID_STATES.has(stateRaw) ? stateRaw : 'all') as 'all' | 'read' | 'unread'

    const db = await getDb()
    const result = await listNotifications(db, {
      tenantId: session.user.organizationId,
      userId: session.user.id,
      page,
      pageSize,
      category,
      state,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[GET /api/notifications]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
