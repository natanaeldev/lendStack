import { NextRequest, NextResponse } from 'next/server'
import { getDb, isDbConfigured } from '@/lib/mongodb'
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/notifications'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'

export async function GET() {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 })
  }

  try {
    const db = await getDb()
    const preferences = await getNotificationPreferences(db, session.user.organizationId, session.user.id)
    return NextResponse.json({ preferences })
  } catch (error: any) {
    console.error('[GET /api/notifications/preferences]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 })
  }

  try {
    const body = await req.json()
    const db = await getDb()
    const preferences = await updateNotificationPreferences(db, session.user.organizationId, session.user.id, {
      categories: body.categories,
      eventTypes: body.eventTypes,
    })
    return NextResponse.json({ success: true, preferences })
  } catch (error: any) {
    console.error('[PATCH /api/notifications/preferences]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
