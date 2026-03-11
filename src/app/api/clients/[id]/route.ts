import { NextRequest, NextResponse }                  from 'next/server'
import { getDb, isDbConfigured }                     from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse }         from '@/lib/orgAuth'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db = await getDb()
    const c  = await db.collection('clients').findOne({
      _id:            params.id as any,
      organizationId: session.user.organizationId,
    })

    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      client: {
        id:      String(c._id),
        savedAt: c.savedAt,
        name:        c.name,
        email:       c.email        ?? '',
        phone:       c.phone        ?? '',
        idType:      c.idType       ?? 'DNI',
        idNumber:    c.idNumber     ?? '',
        birthDate:   c.birthDate    ?? '',
        nationality: c.nationality  ?? '',
        address:     c.address      ?? '',
        occupation:      c.occupation      ?? '',
        monthlyIncome:   c.monthlyIncome   ?? '',
        hasIncomeProof:  c.hasIncomeProof  ?? false,
        currentDebts:    c.currentDebts    ?? '',
        totalDebtValue:  c.totalDebtValue  ?? '',
        paymentCapacity: c.paymentCapacity ?? '',
        collateral:      c.collateral      ?? '',
        territorialTies: c.territorialTies ?? '',
        creditHistory:   c.creditHistory   ?? '',
        reference1:      c.reference1      ?? '',
        reference2:      c.reference2      ?? '',
        notes:           c.notes           ?? '',
        branch:          c.branch          ?? null,
        branchId:        c.branchId        ?? null,
        branchName:      c.branchName      ?? null,
        loanStatus:      c.loanStatus      ?? 'pending',
        loanType:        c.loan?.loanType  ?? 'amortized',
        params: c.loan ? {
          amount:            c.loan.amount,
          termYears:         c.loan.termYears ?? null,
          profile:           c.loan.profile,
          currency:          c.loan.currency,
          rateMode:          c.loan.rateMode,
          customMonthlyRate: c.loan.customMonthlyRate,
          startDate:         c.loan.startDate ?? '',
          termWeeks:         c.loan.termWeeks ?? null,
          carritoTerm:       c.loan.carritoTerm ?? null,
          numPayments:       c.loan.numPayments ?? null,
          frequency:         c.loan.frequency ?? null,
        } : null,
        result: c.loan ? {
          monthlyPayment: c.loan.monthlyPayment,
          totalPayment:   c.loan.totalPayment,
          totalInterest:  c.loan.totalInterest,
          annualRate:     c.loan.annualRate,
          monthlyRate:    c.loan.monthlyRate,
          totalMonths:    c.loan.totalMonths,
          interestRatio:  c.loan.interestRatio,
          weeklyPayment:  c.loan.weeklyPayment ?? null,
          totalWeeks:     c.loan.termWeeks ?? null,
          fixedPayment:   c.loan.fixedPayment ?? null,
          numPayments:    c.loan.numPayments ?? null,
        } : null,
        documents: c.documents ?? [],
        payments:  c.payments  ?? [],
      },
    })
  } catch (err: any) {
    console.error('[GET /api/clients/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db  = await getDb()
    const col = db.collection('clients')

    await col.deleteOne({
      _id:            params.id as any,
      organizationId: session.user.organizationId,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE /api/clients/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body = await req.json()
    const $set: Record<string, any> = {}

    if (body.loanStatus !== undefined) {
      const lifecycleValues = [
        'application_submitted', 'under_review', 'approved', 'denied',
        'disbursed', 'active', 'delinquent', 'paid_off', 'defaulted', 'cancelled',
        'pending',
      ]
      if (!lifecycleValues.includes(body.loanStatus))
        return NextResponse.json({ error: 'Estado invalido' }, { status: 400 })
      const legacyMap: Record<string, string> = {
        application_submitted: 'pending', under_review: 'pending',
        approved: 'approved', denied: 'denied',
        disbursed: 'approved', active: 'approved',
        delinquent: 'approved', paid_off: 'approved',
        defaulted: 'approved', cancelled: 'denied',
      }
      $set.loanStatus = legacyMap[body.loanStatus] ?? body.loanStatus
    }

    const ALLOWED: string[] = [
      'name', 'email', 'phone', 'idType', 'idNumber', 'birthDate',
      'nationality', 'address', 'occupation', 'monthlyIncome', 'hasIncomeProof',
      'currentDebts', 'totalDebtValue', 'paymentCapacity', 'collateral',
      'territorialTies', 'creditHistory', 'reference1', 'reference2', 'notes',
    ]
    for (const field of ALLOWED) {
      if (body[field] !== undefined) $set[field] = body[field]
    }
    if (body.loanStartDate !== undefined) $set['loan.startDate'] = body.loanStartDate

    if (body.branchId !== undefined) {
      if (!body.branchId) {
        $set.branchId   = null
        $set.branchName = null
        $set.branch     = null
      } else {
        const db2 = await getDb()
        const branchDoc = await db2.collection('branches').findOne({
          _id:            body.branchId as any,
          organizationId: session.user.organizationId,
        })
        if (!branchDoc)
          return NextResponse.json({ error: 'Sucursal no encontrada.' }, { status: 404 })
        $set.branchId   = body.branchId
        $set.branch     = branchDoc.type
        $set.branchName = branchDoc.name
      }
    }

    if (Object.keys($set).length === 0)
      return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })

    const db  = await getDb()
    const col = db.collection('clients')

    const result = await col.updateOne(
      { _id: params.id as any, organizationId: session.user.organizationId },
      { $set }
    )

    if (result.matchedCount === 0)
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[PATCH /api/clients/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
