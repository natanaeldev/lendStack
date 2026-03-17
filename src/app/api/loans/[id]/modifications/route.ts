// POST /api/loans/[id]/modifications  — create a modification draft
// GET  /api/loans/[id]/modifications  — list all modifications for this loan

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { createModificationDraft, listModifications } from '@/lib/restructure/service'
import type { ModificationInput }            from '@/lib/restructure/types'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db   = await getDb()
    const mods = await listModifications(db, params.id, session.user.organizationId)
    return NextResponse.json({ modifications: mods })
  } catch (err: any) {
    console.error('[GET /api/loans/[id]/modifications]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body: {
      input: ModificationInput
      submissionReason: string
      borrowerConsent?: {
        obtained: boolean
        method?: 'verbal' | 'written' | 'digital'
        notes?: string
      }
    } = await req.json()

    if (!body.input?.type) {
      return NextResponse.json({ error: 'Se requiere input.type' }, { status: 400 })
    }
    if (!body.submissionReason?.trim()) {
      return NextResponse.json({ error: 'Se requiere submissionReason' }, { status: 400 })
    }

    const db    = await getDb()
    const orgId = session.user.organizationId

    // Resolve actor name from the users collection for audit trail
    const userDoc = await db.collection('users').findOne(
      { email: session.user.email },
      { projection: { name: 1, role: 1 } },
    )

    const actor = {
      id:   session.user.id,
      name: session.user.name ?? userDoc?.name ?? session.user.email ?? 'Desconocido',
      role: session.user.role ?? 'user',
    }

    const { modification, eligibility } = await createModificationDraft(db, {
      loanId:          params.id,
      organizationId:  orgId,
      actor,
      input:           body.input,
      submissionReason: body.submissionReason.trim(),
      borrowerConsent: body.borrowerConsent,
    })

    return NextResponse.json(
      { modification, eligibility },
      { status: 201 },
    )
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/modifications]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
