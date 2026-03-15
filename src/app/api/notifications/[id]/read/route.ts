import { NextResponse } from 'next/server'
import { getDb, isDbConfigured } from '@/lib/mongodb'
import { markNotificationRead } from '@/lib/notifications'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 })
  }

  try {
    const db = await getDb()
    const notification = await markNotificationRead(db, session.user.organizationId, session.user.id, params.id)
    if (!notification) {
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 })
    }
    return NextResponse.json({ success: true, notification })
  } catch (error: any) {
    console.error('[POST /api/notifications/[id]/read]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
