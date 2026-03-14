import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { computeDelinquency, computeLoanContractBalance } from '@/lib/installmentEngine'
import type { InstallmentDoc }              from '@/lib/loanDomain'

// ─── DELETE /api/loans/[id]/payments/[paymentId] — reverse a payment ──────────
// Reverses a payment: restores affected installments, recalculates loan totals,
// recomputes delinquency, then deletes the payment record.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; paymentId: string } },
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db    = await getDb()
    const orgId = session.user.organizationId

    // Fetch the payment
    const payment = await db.collection('payments').findOne({
      _id:            params.paymentId as any,
      loanId:         params.id,
      organizationId: orgId,
    })
    if (!payment) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

    // Fetch the loan
    const loan = await db.collection('loans').findOne({
      _id:            params.id as any,
      organizationId: orgId,
    })
    if (!loan) return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })

    // Cannot reverse payment on a paid-off loan that has no other payments
    // (allow reversal so operators can fix mistakes)

    const now = new Date().toISOString()

    // Reverse each affected installment
    for (const affected of (payment.installmentsAffected ?? [])) {
      const inst = await db.collection('installments').findOne({
        _id:            affected.installmentId as any,
        organizationId: orgId,
      }) as InstallmentDoc | null

      if (!inst) continue

      const reversedAmount    = Math.min(affected.amount, inst.paidAmount)
      const newPaidAmount     = Math.max(inst.paidAmount - reversedAmount, 0)
      // Proportionally reverse principal/interest split
      const ratio = inst.paidAmount > 0 ? reversedAmount / inst.paidAmount : 0
      const newPaidPrincipal  = Math.max(inst.paidPrincipal - inst.paidPrincipal * ratio, 0)
      const newPaidInterest   = Math.max(inst.paidInterest  - inst.paidInterest  * ratio, 0)
      const newRemaining      = inst.scheduledAmount - newPaidAmount

      let newStatus: InstallmentDoc['status'] = 'pending'
      if (newPaidAmount >= inst.scheduledAmount - 0.005) {
        newStatus = 'paid'
      } else if (newPaidAmount > 0) {
        newStatus = 'partial'
      } else {
        const today = new Date().toISOString().slice(0, 10)
        newStatus = inst.dueDate < today ? 'overdue' : 'pending'
      }

      await db.collection('installments').updateOne(
        { _id: affected.installmentId as any, organizationId: orgId },
        {
          $set: {
            paidAmount:     newPaidAmount,
            paidPrincipal:  newPaidPrincipal,
            paidInterest:   newPaidInterest,
            remainingAmount: newRemaining,
            status:         newStatus,
            paidAt:         newStatus === 'paid' ? inst.paidAt : null,
          },
        },
      )
    }

    // Recompute delinquency from updated installments
    const rawInstallments = await db.collection('installments')
      .find({ loanId: params.id, organizationId: orgId })
      .sort({ installmentNumber: 1 })
      .toArray()
    const installments = rawInstallments as unknown as InstallmentDoc[]

    // Update loan running totals
    const newPaidTotal   = Math.max((loan.paidTotal    ?? 0) - payment.amount, 0)
    const newPaidPrin    = Math.max((loan.paidPrincipal ?? 0) - (payment.appliedPrincipal ?? 0), 0)
    const newPaidInt     = Math.max((loan.paidInterest  ?? 0) - (payment.appliedInterest  ?? 0), 0)
    const newRemaining   = computeLoanContractBalance({
      totalPayment: loan.totalPayment,
      paidTotal: newPaidTotal,
      remainingBalance: loan.remainingBalance,
    } as any, installments)

    const delinquency = computeDelinquency(installments)

    let newStatus = loan.status
    // Reopen a paid_off loan if reversal takes it above zero balance
    if (loan.status === 'paid_off' && newRemaining > 0.005) {
      newStatus = delinquency.isDelinquent ? 'delinquent' : 'active'
    } else if (delinquency.isDelinquent) {
      newStatus = 'delinquent'
    } else if (loan.status === 'delinquent') {
      newStatus = 'active'
    }

    await db.collection('loans').updateOne(
      { _id: params.id as any, organizationId: orgId },
      {
        $set: {
          paidTotal:                newPaidTotal,
          paidPrincipal:            newPaidPrin,
          paidInterest:             newPaidInt,
          remainingBalance:         newRemaining,
          status:                   newStatus,
          daysPastDue:              delinquency.daysPastDue,
          overdueInstallmentsCount: delinquency.overdueInstallmentsCount,
          overdueAmount:            delinquency.overdueAmount,
          updatedAt:                now,
        },
      },
    )

    // Delete the payment record
    await db.collection('payments').deleteOne({
      _id:            params.paymentId as any,
      organizationId: orgId,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE /api/loans/[id]/payments/[paymentId]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
