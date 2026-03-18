import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { generateInstallments }              from '@/lib/installmentEngine'
import type { LoanDoc }                      from '@/lib/loanDomain'
import { emitNotification }                  from '@/lib/notifications'

// ─── POST /api/loans/[id]/disburse ───────────────────────────────────────────
// Disbursement is a manual action. The loan must be in 'approved' state.
// After disbursement:
//   - loan.status → 'active'
//   - installment schedule is generated and persisted
//   - loan totals are initialized
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  // Only managers and above can disburse loans
  const canDisburse =
    session.user.role === 'master' ||
    session.user.isOrganizationOwner ||
    session.user.role === 'manager' ||
    session.user.organizationRole?.toUpperCase() === 'MANAGER'

  if (!canDisburse) {
    return NextResponse.json(
      { error: 'No tiene permisos para desembolsar préstamos. Se requiere rol de Gerente o superior.' },
      { status: 403 },
    )
  }

  try {
    const body = await req.json()
    const { disbursedAmount, notes } = body

    const db    = await getDb()
    const orgId = session.user.organizationId

    const loan = await db.collection('loans').findOne({
      _id:            params.id as any,
      organizationId: orgId,
    })

    if (!loan) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })

    // Only approved loans can be disbursed
    if (!['approved', 'disbursed'].includes(loan.status)) {
      return NextResponse.json(
        { error: `No se puede desembolsar un préstamo en estado "${loan.status}"` },
        { status: 400 },
      )
    }

    // Block disbursement if reauth/approval flow is incomplete
    if (loan.disbursementLocked) {
      return NextResponse.json(
        { error: 'El desembolso está bloqueado hasta completar la reautorización y aprobación requeridas.' },
        { status: 400 },
      )
    }

    // Idempotency: if already disbursed, check whether installments exist
    const existingInstallments = await db.collection('installments')
      .countDocuments({ loanId: params.id, organizationId: orgId })

    const now         = new Date().toISOString()
    const disbAmount  = disbursedAmount ?? loan.netDisbursedAmount ?? loan.amount
    const disbDate    = now

    // ── Update loan ──────────────────────────────────────────────────────────
    await db.collection('loans').updateOne(
      { _id: params.id as any, organizationId: orgId },
      {
        $set: {
          status:           'active',
          disbursedAt:      disbDate,
          disbursedAmount:  disbAmount,
          disbursedBy:      session.user.id,
          disbursementNotes: notes ?? undefined,
          startDate:        disbDate.slice(0, 10),
          updatedAt:        now,
        },
      },
    )

    // ── Generate installments if not already done ─────────────────────────────
    if (existingInstallments === 0) {
      const updatedLoan: LoanDoc = {
        ...(loan as any),
        _id:        params.id,
        disbursedAt: disbDate,
        startDate:  disbDate.slice(0, 10),
        disbursedAmount: disbAmount,
      }
      const installments = generateInstallments(updatedLoan, orgId)
      if (installments.length > 0) {
        await db.collection('installments').insertMany(installments as any[])
      }
    }

    // ── Sync client loanStatus ────────────────────────────────────────────────
    await db.collection('clients').updateOne(
      { _id: loan.clientId as any, organizationId: orgId },
      { $set: { loanStatus: 'approved', updatedAt: now } },
    )

    const client = await db.collection('clients').findOne(
      { _id: loan.clientId as any, organizationId: orgId },
      { projection: { _id: 1, name: 1, email: 1 } },
    )
    const amountLabel = new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: String(loan.currency ?? 'USD'),
      maximumFractionDigits: 2,
    }).format(Number(disbAmount))

    await emitNotification(db, {
      tenantId: orgId,
      actorUserId: session.user.id,
      type: 'disbursement.sent',
      entityType: 'loan',
      entityId: params.id,
      actionUrl: `/app/prestamos?loanId=${params.id}`,
      message: `${client?.name ?? 'Cliente'} fue desembolsado por ${amountLabel}.`,
      metadata: {
        clientId: loan.clientId,
        clientName: client?.name ?? 'Cliente',
        disbursedAmount: disbAmount,
        currency: String(loan.currency ?? 'USD'),
      },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/disburse]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
