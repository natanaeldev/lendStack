import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { LOAN_STATUS_CONFIG, type LoanStatus } from '@/lib/loanDomain'
import { computeDelinquency }                from '@/lib/installmentEngine'
import { emitNotification }                  from '@/lib/notifications'

const VALID_STATUSES = Object.keys(LOAN_STATUS_CONFIG) as LoanStatus[]

// ─── GET /api/loans/[id] ──────────────────────────────────────────────────────
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

    // Borrower
    const client = await db.collection('clients').findOne({
      _id:            loan.clientId as any,
      organizationId: orgId,
    })

    // Installments
    const installments = await db.collection('installments')
      .find({ loanId: params.id, organizationId: orgId })
      .sort({ installmentNumber: 1 })
      .toArray()

    // Payments
    const payments = await db.collection('payments')
      .find({ loanId: params.id, organizationId: orgId })
      .sort({ date: -1 })
      .toArray()

    // Collection actions
    const collections = await db.collection('collection_actions')
      .find({ loanId: params.id, organizationId: orgId })
      .sort({ createdAt: -1 })
      .toArray()

    // Live delinquency
    const delinquency = computeDelinquency(installments as any)

    return NextResponse.json({
      loan:         { ...loan, _id: String(loan._id) },
      borrower:     client ? { ...client, _id: String(client._id) } : null,
      installments: installments.map(i => ({ ...i, _id: String(i._id) })),
      payments:     payments.map(p => ({ ...p, _id: String(p._id) })),
      collections:  collections.map(c => ({ ...c, _id: String(c._id) })),
      delinquency,
    })
  } catch (err: any) {
    console.error('[GET /api/loans/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── PATCH /api/loans/[id] — update status or notes ──────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body  = await req.json()
    const $set: Record<string, any> = { updatedAt: new Date().toISOString() }

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
      }
      $set.status = body.status
    }
    if (body.notes !== undefined) $set.notes = body.notes

    if (Object.keys($set).length === 1)
      return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })

    const db  = await getDb()
    const currentLoan = await db.collection('loans').findOne(
      { _id: params.id as any, organizationId: session.user.organizationId },
      { projection: { _id: 1, clientId: 1, status: 1, amount: 1, currency: 1 } },
    )
    const res = await db.collection('loans').updateOne(
      { _id: params.id as any, organizationId: session.user.organizationId },
      { $set },
    )

    if (res.matchedCount === 0)
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })

    // Sync client loanStatus for backward compat
    if (body.status) {
      const legacyMap: Record<string, string> = {
        application_submitted: 'pending',
        under_review:          'pending',
        approved:              'approved',
        denied:                'denied',
        disbursed:             'approved',
        active:                'approved',
        delinquent:            'approved',
        paid_off:              'approved',
        defaulted:             'approved',
        cancelled:             'denied',
      }
      const legacyStatus = legacyMap[body.status]
      if (legacyStatus) {
        const loan = currentLoan ?? await db.collection('loans').findOne({ _id: params.id as any })
        if (loan?.clientId) {
          await db.collection('clients').updateOne(
            { _id: loan.clientId as any, organizationId: session.user.organizationId },
            { $set: { loanStatus: legacyStatus } },
          )
        }
      }

      if (currentLoan?.status !== body.status) {
        const client = currentLoan?.clientId
          ? await db.collection('clients').findOne(
              { _id: currentLoan.clientId as any, organizationId: session.user.organizationId },
              { projection: { _id: 1, name: 1 } },
            )
          : null

        if (body.status === 'approved') {
          await emitNotification(db, {
            tenantId: session.user.organizationId,
            actorUserId: session.user.id,
            type: 'loan.approved',
            entityType: 'loan',
            entityId: params.id,
            actionUrl: `/app/prestamos?loanId=${params.id}`,
            message: `${client?.name ?? 'Cliente'} fue aprobado para desembolso.`,
            metadata: {
              clientId: currentLoan?.clientId ?? null,
              clientName: client?.name ?? 'Cliente',
            },
          })
        }

        if (body.status === 'denied') {
          await emitNotification(db, {
            tenantId: session.user.organizationId,
            actorUserId: session.user.id,
            type: 'loan.rejected',
            entityType: 'loan',
            entityId: params.id,
            actionUrl: `/app/prestamos?loanId=${params.id}`,
            message: `${client?.name ?? 'Cliente'} fue rechazado y requiere seguimiento comercial.`,
            metadata: {
              clientId: currentLoan?.clientId ?? null,
              clientName: client?.name ?? 'Cliente',
            },
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[PATCH /api/loans/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
