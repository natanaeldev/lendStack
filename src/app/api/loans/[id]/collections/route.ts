import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { COLLECTION_ACTION_LABELS }          from '@/lib/loanDomain'
import { v4 as uuidv4 }                      from 'uuid'

const VALID_ACTION_TYPES = Object.keys(COLLECTION_ACTION_LABELS)

// ─── GET /api/loans/[id]/collections — list collection actions ────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db    = await getDb()
    const orgId = session.user.organizationId

    const loan = await db.collection('loans').findOne({
      _id:            params.id as any,
      organizationId: orgId,
    })
    if (!loan) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })

    const actions = await db.collection('collection_actions')
      .find({ loanId: params.id, organizationId: orgId })
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json({
      collections: actions.map(a => ({ ...a, _id: String(a._id) })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── POST /api/loans/[id]/collections — add a collection action ───────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body = await req.json()
    const { date, actionType, note, promisedPaymentDate, promisedAmount } = body

    if (!date || !actionType) {
      return NextResponse.json({ error: 'date y actionType son requeridos' }, { status: 400 })
    }
    if (!VALID_ACTION_TYPES.includes(actionType)) {
      return NextResponse.json({ error: 'Tipo de acción inválido' }, { status: 400 })
    }

    const db    = await getDb()
    const orgId = session.user.organizationId

    const loan = await db.collection('loans').findOne({
      _id:            params.id as any,
      organizationId: orgId,
    })
    if (!loan) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })

    const now    = new Date().toISOString()
    const action = {
      _id:            uuidv4(),
      organizationId: orgId,
      loanId:         params.id,
      clientId:       loan.clientId,
      date,
      actionType,
      note:               note?.trim()           ?? undefined,
      promisedPaymentDate: promisedPaymentDate   ?? undefined,
      promisedAmount:      promisedAmount        ?? undefined,
      createdAt:      now,
      createdBy:      session.user.id,
    }

    await db.collection('collection_actions').insertOne(action as any)

    return NextResponse.json({ success: true, actionId: action._id })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/collections]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
