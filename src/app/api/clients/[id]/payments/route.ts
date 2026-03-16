import { NextRequest, NextResponse }          from 'next/server'
import { randomUUID }                         from 'crypto'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { applyPayment, computeDelinquency, computeLoanContractBalance }  from '@/lib/installmentEngine'
import type { InstallmentDoc }               from '@/lib/loanDomain'

async function getLinkedLoan(db: any, orgId: string, clientId: string, clientDoc?: any) {
  const linkedLoanId = clientDoc?.loan?.id
  if (linkedLoanId) {
    const loan = await db.collection('loans').findOne({
      _id:            linkedLoanId as any,
      organizationId: orgId,
    })
    if (loan) return loan
  }

  return db.collection('loans').findOne(
    { clientId, organizationId: orgId },
    { sort: { createdAt: -1 } },
  )
}

async function reverseGlobalPayment(db: any, orgId: string, loanId: string, payment: any) {
  for (const affected of (payment.installmentsAffected ?? [])) {
    const inst = await db.collection('installments').findOne({
      _id:            affected.installmentId as any,
      organizationId: orgId,
    }) as InstallmentDoc | null

    if (!inst) continue

    const reversedAmount   = Math.min(affected.amount, inst.paidAmount)
    const newPaidAmount    = Math.max(inst.paidAmount - reversedAmount, 0)
    const ratio            = inst.paidAmount > 0 ? reversedAmount / inst.paidAmount : 0
    const newPaidPrincipal = Math.max(inst.paidPrincipal - inst.paidPrincipal * ratio, 0)
    const newPaidInterest  = Math.max(inst.paidInterest - inst.paidInterest * ratio, 0)
    const newRemaining     = inst.scheduledAmount - newPaidAmount

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
          paidAmount:      newPaidAmount,
          paidPrincipal:   newPaidPrincipal,
          paidInterest:    newPaidInterest,
          remainingAmount: newRemaining,
          status:          newStatus,
          paidAt:          newStatus === 'paid' ? inst.paidAt : null,
        },
      },
    )
  }

  const loan = await db.collection('loans').findOne({
    _id:            loanId as any,
    organizationId: orgId,
  })
  if (!loan) return

  const rawInstallments = await db.collection('installments')
    .find({ loanId, organizationId: orgId })
    .sort({ installmentNumber: 1 })
    .toArray()
  const installments = rawInstallments as unknown as InstallmentDoc[]
  const delinquency  = computeDelinquency(installments)

  const newPaidTotal = Math.max((loan.paidTotal ?? 0) - payment.amount, 0)
  const newPaidPrin  = Math.max((loan.paidPrincipal ?? 0) - (payment.appliedPrincipal ?? 0), 0)
  const newPaidInt   = Math.max((loan.paidInterest ?? 0) - (payment.appliedInterest ?? 0), 0)
  const newRemaining = computeLoanContractBalance({
    totalPayment: loan.totalPayment,
    paidTotal: Math.max((loan.paidTotal ?? 0) - payment.amount, 0),
    remainingBalance: loan.remainingBalance,
  } as any, installments)

  let newStatus = loan.status
  if (loan.status === 'paid_off' && newRemaining > 0.005) {
    newStatus = delinquency.isDelinquent ? 'delinquent' : 'active'
  } else if (delinquency.isDelinquent) {
    newStatus = 'delinquent'
  } else if (loan.status === 'delinquent') {
    newStatus = 'active'
  }

  await db.collection('loans').updateOne(
    { _id: loanId as any, organizationId: orgId },
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
        updatedAt:                new Date().toISOString(),
      },
    },
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 })
  }

  try {
    const contentType = req.headers.get('content-type') ?? ''

    let date: string
    let amount: number
    let cuotaNumber: number | undefined
    let notes: string | undefined
    let comprobanteFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const fd = await req.formData()
      date   = fd.get('date') as string
      amount = parseFloat(fd.get('amount') as string)
      const cn = fd.get('cuotaNumber') as string | null
      const nt = fd.get('notes') as string | null
      if (cn?.trim()) cuotaNumber = parseInt(cn, 10)
      if (nt?.trim()) notes = nt.trim()
      comprobanteFile = fd.get('comprobante') as File | null
    } else {
      const body = await req.json()
      date        = body.date
      amount      = body.amount
      cuotaNumber = body.cuotaNumber !== undefined ? body.cuotaNumber : undefined
      if (body.notes?.trim()) notes = body.notes.trim()
    }

    if (!date || typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 })
    }

    let comprobanteUrl: string | undefined
    const imageTooLargeError = 'La imagen no puede superar 10 MB'
    const blobTokenError = 'Configura BLOB_READ_WRITE_TOKEN para imagenes > 500 KB'

    if (comprobanteFile && comprobanteFile.size > 0) {
      if (comprobanteFile.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: imageTooLargeError }, { status: 400 })
      }

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob')
        const blob = await put(
          `lendstack-comprobantes/${params.id}/${Date.now()}-comprobante`,
          comprobanteFile,
          { access: 'public' }
        )
        comprobanteUrl = blob.url
      } else {
        if (comprobanteFile.size > 500 * 1024) {
          return NextResponse.json({ error: blobTokenError }, { status: 400 })
        }
        const buf = await comprobanteFile.arrayBuffer()
        comprobanteUrl = `data:${comprobanteFile.type};base64,${Buffer.from(buf).toString('base64')}`
      }
    }

    const payment: Record<string, any> = {
      id:           randomUUID(),
      date,
      amount,
      registeredAt: new Date().toISOString(),
    }
    if (cuotaNumber !== undefined) payment.cuotaNumber = cuotaNumber
    if (notes) payment.notes = notes
    if (comprobanteUrl) payment.comprobanteUrl = comprobanteUrl

    const db    = await getDb()
    const orgId = session.user.organizationId

    const client = await db.collection('clients').findOne({
      _id:            params.id as any,
      organizationId: orgId,
    })
    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const result = await db.collection('clients').updateOne(
      { _id: params.id as any, organizationId: orgId },
      { $push: { payments: payment } } as any
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const loan = await getLinkedLoan(db, orgId, params.id, client)
    if (!loan) return NextResponse.json({ payment, globalSynced: false })

    if (['denied', 'cancelled', 'paid_off'].includes(loan.status)) {
      await db.collection('clients').updateOne(
        { _id: params.id as any, organizationId: orgId },
        { $pull: { payments: { id: payment.id } } } as any
      )
      return NextResponse.json(
        { error: `No se puede registrar pago en un prestamo en estado "${loan.status}"` },
        { status: 400 },
      )
    }

    try {
      const rawInstallments = await db.collection('installments')
        .find({ loanId: String(loan._id), organizationId: orgId })
        .sort({ installmentNumber: 1 })
        .toArray()
      const installments = rawInstallments as unknown as InstallmentDoc[]
      const outstandingBeforePayment = computeLoanContractBalance(loan as any, installments)

      if (amount > outstandingBeforePayment + 0.005) {
        await db.collection('clients').updateOne(
          { _id: params.id as any, organizationId: orgId },
          { $pull: { payments: { id: payment.id } } } as any
        )
        return NextResponse.json(
          { error: `El monto (${amount}) supera el saldo pendiente (${outstandingBeforePayment.toFixed(2)})` },
          { status: 400 },
        )
      }

      const applied      = applyPayment(installments, amount)

      const appliedPrincipal = rawInstallments.length > 0
        ? applied.applied.reduce((sum, item) => sum + item.principal, 0)
        : amount
      const appliedInterest = rawInstallments.length > 0
        ? applied.applied.reduce((sum, item) => sum + item.interest, 0)
        : 0

      const paymentDoc = {
        _id:                 randomUUID(),
        organizationId:      orgId,
        loanId:              String(loan._id),
        clientId:            params.id,
        date,
        amount,
        appliedPrincipal,
        appliedInterest,
        installmentsAffected: applied.applied.map(item => ({
          installmentId: item.installmentId,
          amount:        item.amount,
        })),
        notes:           notes ?? undefined,
        registeredAt:    payment.registeredAt,
        registeredBy:    session.user.id,
        source:          'client_payment',
        legacyPaymentId: payment.id,
        comprobanteUrl:  comprobanteUrl ?? undefined,
        cuotaNumber:     cuotaNumber ?? undefined,
      }
      await db.collection('payments').insertOne(paymentDoc as any)

      for (const updated of applied.updatedInstallments) {
        const orig = installments.find(inst => inst._id === updated._id)
        if (!orig || orig.paidAmount === updated.paidAmount) continue

        await db.collection('installments').updateOne(
          { _id: updated._id as any, organizationId: orgId },
          {
            $set: {
              paidAmount:      updated.paidAmount,
              paidPrincipal:   updated.paidPrincipal,
              paidInterest:    updated.paidInterest,
              remainingAmount: updated.remainingAmount,
              status:          updated.status,
              paidAt:          updated.paidAt ?? null,
            },
          },
        )
      }

      const newPaidTotal = (loan.paidTotal ?? 0) + amount
      const newPaidPrin  = (loan.paidPrincipal ?? 0) + appliedPrincipal
      const newPaidInt   = (loan.paidInterest ?? 0) + appliedInterest
      const newRemaining = computeLoanContractBalance({
        totalPayment: loan.totalPayment,
        paidTotal: newPaidTotal,
        remainingBalance: loan.remainingBalance,
      } as any, applied.updatedInstallments)
      const delinquency  = computeDelinquency(applied.updatedInstallments)

      let newStatus = loan.status
      if (newRemaining <= 0.005) {
        newStatus = 'paid_off'
      } else if (delinquency.isDelinquent) {
        newStatus = 'delinquent'
      } else if (['delinquent', 'disbursed'].includes(loan.status)) {
        newStatus = 'active'
      }

      await db.collection('loans').updateOne(
        { _id: loan._id as any, organizationId: orgId },
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
            updatedAt:                payment.registeredAt,
          },
        },
      )

      return NextResponse.json({ payment, globalSynced: true, loanId: String(loan._id) })
    } catch (syncErr: any) {
      await db.collection('clients').updateOne(
        { _id: params.id as any, organizationId: orgId },
        { $pull: { payments: { id: payment.id } } } as any
      )
      console.error('[POST /api/clients/[id]/payments][global-sync]', syncErr)
      return NextResponse.json(
        { error: syncErr.message ?? 'No se pudo sincronizar el pago globalmente' },
        { status: 500 },
      )
    }
  } catch (err: any) {
    console.error('[POST /api/clients/[id]/payments]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 })
  }

  try {
    const { paymentId } = await req.json()
    if (!paymentId) return NextResponse.json({ error: 'paymentId requerido' }, { status: 400 })

    const db    = await getDb()
    const orgId = session.user.organizationId

    const client = await db.collection('clients').findOne({
      _id:            params.id as any,
      organizationId: orgId,
    })
    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const legacyPayment = (client.payments ?? []).find((p: any) => p.id === paymentId)
    if (!legacyPayment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    }

    const mirroredPayments = await db.collection('payments').find({
      organizationId: orgId,
      clientId:       params.id,
      source:         'client_payment',
      legacyPaymentId: paymentId,
    }).toArray()

    for (const mirroredPayment of mirroredPayments) {
      try {
        await reverseGlobalPayment(db, orgId, mirroredPayment.loanId, mirroredPayment)
        await db.collection('payments').deleteOne({
          _id:            mirroredPayment._id as any,
          organizationId: orgId,
        })
      } catch (syncErr) {
        console.error('[DELETE /api/clients/[id]/payments][global-sync]', syncErr)
      }
    }

    const result = await db.collection('clients').updateOne(
      { _id: params.id as any, organizationId: orgId },
      { $pull: { payments: { id: paymentId } } } as any
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE /api/clients/[id]/payments]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
