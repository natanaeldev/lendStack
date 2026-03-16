import { NextResponse } from 'next/server'
import { getDb, isDbConfigured } from '@/lib/mongodb'
import { getUnreadNotificationCount } from '@/lib/notifications'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'

export async function GET() {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false, unreadCount: 0 }, { status: 503 })
  }

  try {
    const db = await getDb()
    const unreadCount = await getUnreadNotificationCount(db, session.user.organizationId, session.user.id)
    return NextResponse.json({ unreadCount })
  } catch (error: any) {
    console.error('[GET /api/notifications/count]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
