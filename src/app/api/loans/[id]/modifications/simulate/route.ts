// POST /api/loans/[id]/modifications/simulate
// Stateless — runs simulation and returns before/after comparison.
// Nothing is saved to the database.

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { getLoanStateForSimulation }         from '@/lib/restructure/service'
import { simulateModification }              from '@/lib/restructure/simulator'
import type { ModificationInput }            from '@/lib/restructure/types'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body: { input: ModificationInput } = await req.json()
    if (!body.input?.type) {
      return NextResponse.json({ error: 'Se requiere input.type' }, { status: 400 })
    }

    const db    = await getDb()
    const orgId = session.user.organizationId

    const state = await getLoanStateForSimulation(db, params.id, orgId)
    if (!state) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
    }

    if (state.unpaidInstallments.length === 0) {
      return NextResponse.json(
        { error: 'No hay cuotas pendientes de pago. El préstamo puede estar cancelado o totalmente pagado.' },
        { status: 422 },
      )
    }

    const simulation = simulateModification(state, body.input)

    return NextResponse.json({ simulation })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/modifications/simulate]', err)
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
