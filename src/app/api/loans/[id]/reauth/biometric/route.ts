// ─── POST /api/loans/[id]/reauth/biometric ───────────────────────────────────
// Process biometric verification step.
// Body: { sessionId, biometricType, verificationReference, passed }
// verificationReference is a provider token — no raw biometric data stored.

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { processBiometric }                  from '@/lib/loanReauth/service'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body = await req.json()
    const { sessionId, biometricType, verificationReference, passed } = body

    if (!sessionId || !biometricType || !verificationReference || passed === undefined) {
      return NextResponse.json(
        { error: 'sessionId, biometricType, verificationReference y passed son requeridos' },
        { status: 400 },
      )
    }

    if (!['face', 'fingerprint'].includes(biometricType)) {
      return NextResponse.json({ error: 'biometricType debe ser "face" o "fingerprint"' }, { status: 400 })
    }

    const db = await getDb()
    const updatedSession = await processBiometric(
      db,
      {
        organizationId:        session.user.organizationId,
        sessionId,
        biometricType,
        verificationReference,
        passed: Boolean(passed),
      },
      { actorId: session.user.id, actorRole: session.user.role ?? 'user' },
    )

    return NextResponse.json({ success: true, session: updatedSession })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/reauth/biometric]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
