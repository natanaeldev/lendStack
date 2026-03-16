import { NextResponse } from 'next/server'
import { getDb, isDbConfigured } from '@/lib/mongodb'
import { markAllNotificationsRead } from '@/lib/notifications'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'

export async function POST() {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 })
  }

  try {
    const db = await getDb()
    const modifiedCount = await markAllNotificationsRead(db, session.user.organizationId, session.user.id)
    return NextResponse.json({ success: true, modifiedCount })
  } catch (error: any) {
    console.error('[POST /api/notifications/mark-all-read]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
