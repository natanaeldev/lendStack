import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { applyPayment, computeDelinquency }  from '@/lib/installmentEngine'
import { v4 as uuidv4 }                      from 'uuid'
import type { InstallmentDoc }               from '@/lib/loanDomain'

// ─── POST /api/loans/[id]/payments — post a payment against a loan ────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body = await req.json()
    const { date, amount, targetInstallmentId, notes } = body

    if (!date || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'date y amount requeridos' }, { status: 400 })
    }

    const db    = await getDb()
    const orgId = session.user.organizationId

    const loan = await db.collection('loans').findOne({
      _id:            params.id as any,
      organizationId: orgId,
    })
    if (!loan) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })

    // Block payments on closed loans
    if (['denied', 'cancelled', 'paid_off'].includes(loan.status)) {
      return NextResponse.json(
        { error: `No se puede registrar pago en un préstamo en estado "${loan.status}"` },
        { status: 400 },
      )
    }

    // Block overpayment: amount > remainingBalance
    if (amount > loan.remainingBalance + 0.005) {
      return NextResponse.json(
        { error: `El monto (${amount}) supera el saldo pendiente (${loan.remainingBalance.toFixed(2)})` },
        { status: 400 },
      )
    }

    // Fetch installments
    const rawInstallments = await db.collection('installments')
      .find({ loanId: params.id, organizationId: orgId })
      .sort({ installmentNumber: 1 })
      .toArray()
    const installments = rawInstallments as unknown as InstallmentDoc[]

    // Apply payment
    const result = applyPayment(installments, amount, targetInstallmentId)

    // If no installments exist (older flow), just record payment against loan totals
    const paymentId = uuidv4()
    const now       = new Date().toISOString()

    // Persist payment record
    const paymentDoc = {
      _id:            paymentId,
      organizationId: orgId,
      loanId:         params.id,
      clientId:       loan.clientId,
      date,
      amount,
      appliedPrincipal: result.applied.reduce((s, a) => s + a.principal, 0),
      appliedInterest:  result.applied.reduce((s, a) => s + a.interest, 0),
      installmentsAffected: result.applied.map(a => ({ installmentId: a.installmentId, amount: a.amount })),
      notes:       notes ?? undefined,
      registeredAt: now,
      registeredBy: session.user.id,
    }
    await db.collection('payments').insertOne(paymentDoc as any)

    // Update each affected installment
    for (const updated of result.updatedInstallments) {
      const orig = installments.find(i => i._id === updated._id)
      if (!orig) continue
      // Only update docs that changed
      if (orig.paidAmount === updated.paidAmount) continue
      await db.collection('installments').updateOne(
        { _id: updated._id as any, organizationId: orgId },
        {
          $set: {
            paidAmount:     updated.paidAmount,
            paidPrincipal:  updated.paidPrincipal,
            paidInterest:   updated.paidInterest,
            remainingAmount: updated.remainingAmount,
            status:         updated.status,
            paidAt:         updated.paidAt ?? null,
          },
        },
      )
    }

    // Update loan running totals
    const newPaidTotal   = loan.paidTotal    + amount
    const newPaidPrin    = loan.paidPrincipal + paymentDoc.appliedPrincipal
    const newPaidInt     = loan.paidInterest  + paymentDoc.appliedInterest
    const newRemaining   = Math.max(loan.remainingBalance - paymentDoc.appliedPrincipal, 0)

    // Determine new loan status
    const delinquency   = computeDelinquency(result.updatedInstallments)
    let newStatus = loan.status
    if (newRemaining <= 0.005) {
      newStatus = 'paid_off'
    } else if (delinquency.isDelinquent) {
      newStatus = 'delinquent'
    } else if (['delinquent', 'disbursed'].includes(loan.status)) {
      newStatus = 'active'
    }

    await db.collection('loans').updateOne(
      { _id: params.id as any, organizationId: orgId },
      {
        $set: {
          paidTotal:        newPaidTotal,
          paidPrincipal:    newPaidPrin,
          paidInterest:     newPaidInt,
          remainingBalance: newRemaining,
          status:           newStatus,
          daysPastDue:              delinquency.daysPastDue,
          overdueInstallmentsCount: delinquency.overdueInstallmentsCount,
          overdueAmount:            delinquency.overdueAmount,
          updatedAt:        now,
        },
      },
    )

    return NextResponse.json({ success: true, paymentId, overpayment: result.overpayment })
  } catch (err: any) {
    console.error('[POST /api/loans/[id]/payments]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── GET /api/loans/[id]/payments — list payments for a loan ─────────────────
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

    const payments = await db.collection('payments')
      .find({ loanId: params.id, organizationId: orgId })
      .sort({ date: -1 })
      .toArray()

    return NextResponse.json({ payments: payments.map(p => ({ ...p, _id: String(p._id) })) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
