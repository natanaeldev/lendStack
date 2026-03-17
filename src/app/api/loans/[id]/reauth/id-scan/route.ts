// ─── POST /api/loans/[id]/reauth/id-scan ─────────────────────────────────────
// Process the ID scan step of the reauth flow.
// Body: { sessionId, scanReference, passed }
// scanReference is a blob/S3 key — the backend never receives raw image data.

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { processIdScan }                     from '@/lib/loanReauth/service'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body = await req.json()
    const { sessionId, scanReference, passed } = body

    if (!sessionId || !scanReference || passed === undefined) {
      return NextResponse.json(
        { error: 'sessionId, scanReference y passed son requeridos' },
        { status: 400 },
      )
    }

    const db = await getDb()
    const updatedSession = await processIdScan(
      db,
      {
        organizationId: session.user.organizationId,
        sessionId,
        scanReference,
        passed: Boolean(passed),
      },
      { actorId: session.user.id, actorRole: session.user.role ?? 'user' },
    )

    return NextResponse.json({ success: true, session: updatedSession })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/reauth/id-scan]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
