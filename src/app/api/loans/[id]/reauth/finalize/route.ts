// ─── POST /api/loans/[id]/reauth/finalize ────────────────────────────────────
// Finalizes the reauth session — transitions loan to reauth_completed.
// Body: { sessionId }

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { finalizeReauthSession }             from '@/lib/loanReauth/service'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body = await req.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId es requerido' }, { status: 400 })
    }

    const db = await getDb()
    const updatedSession = await finalizeReauthSession(
      db,
      { organizationId: session.user.organizationId, sessionId },
      { actorId: session.user.id, actorRole: session.user.role ?? 'user' },
    )

    return NextResponse.json({ success: true, session: updatedSession })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/reauth/finalize]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
