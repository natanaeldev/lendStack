import { NextRequest, NextResponse }                  from 'next/server'
import { getDb, isDbConfigured }                     from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse }         from '@/lib/orgAuth'
import { inferLegacyInterestMethod, inferLegacyPaymentFrequency } from '@/lib/loan'


function inferLoanType(loan: any): 'amortized' | 'weekly' | 'carrito' {
  if (!loan) return 'amortized'
  const raw = String(loan.loanType ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_')
  if (raw === 'weekly') return 'weekly'
  if (['carrito', 'flat', 'flat_rate', 'interes_plano'].includes(raw)) return 'carrito'

  const hasWeeklySignals = loan.termWeeks != null || loan.weeklyRate != null || loan.weeklyPayment != null
  if (hasWeeklySignals) return 'weekly'

  const hasCarritoSignals =
    loan.flatRate != null || loan.carritoTerm != null || loan.numPayments != null || loan.frequency != null || loan.fixedPayment != null
  if (hasCarritoSignals) return 'carrito'

  return 'amortized'
}

function buildClientLoanParams(loan: any) {
  return {
    amount: loan?.amount ?? 0,
    termYears: loan?.termYears ?? null,
    profile: loan?.profile ?? 'Medium Risk',
    currency: loan?.currency ?? 'USD',
    rateMode: loan?.rateMode ?? 'annual',
    customMonthlyRate: loan?.customMonthlyRate ?? 0,
    interestMethod: loan ? (loan.interestMethod ?? inferLegacyInterestMethod(loan.loanType, loan.interestMethod)) : null,
    paymentFrequency: loan ? (loan.paymentFrequency ?? inferLegacyPaymentFrequency(loan.loanType, loan.frequency)) : null,
    installmentCount: loan ? (loan.installmentCount ?? loan.numPayments ?? loan.termWeeks ?? loan.totalMonths ?? null) : null,
    interestPeriodCount: loan ? (loan.interestPeriodCount ?? loan.carritoTerm ?? null) : null,
    rateValue: loan ? (loan.rateValue ?? loan.flatRate ?? loan.monthlyRate ?? loan.customMonthlyRate ?? 0) : 0,
    rateUnit: loan?.rateUnit ?? 'DECIMAL',
    startDate: loan?.startDate ?? '',
    termWeeks: loan?.termWeeks ?? null,
    carritoTerm: loan?.carritoTerm ?? null,
    numPayments: loan?.numPayments ?? null,
    frequency: loan?.frequency ?? null,
  }
}

function buildClientLoanResult(loan: any) {
  return {
    monthlyPayment: loan?.monthlyPayment ?? 0,
    totalPayment: loan?.totalPayment ?? 0,
    totalInterest: loan?.totalInterest ?? 0,
    annualRate: loan?.annualRate ?? 0,
    monthlyRate: loan?.monthlyRate ?? 0,
    totalMonths: loan?.totalMonths ?? null,
    interestRatio: loan?.interestRatio ?? 0,
    interestMethod: loan ? (loan.interestMethod ?? inferLegacyInterestMethod(loan.loanType, loan.interestMethod)) : null,
    weeklyPayment: loan?.weeklyPayment ?? null,
    totalWeeks: loan?.termWeeks ?? null,
    fixedPayment: loan?.fixedPayment ?? null,
    numPayments: loan?.numPayments ?? null,
  }
}

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
        loanType:        inferLoanType(c.loan),
        params: buildClientLoanParams(c.loan),
        result: buildClientLoanResult(c.loan),
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
