import { NextRequest, NextResponse }                  from 'next/server'
import { getDb, isDbConfigured }                     from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse }         from '@/lib/orgAuth'

// ─── GET /api/clients/[id] — fetch single client ──────────────────────────────
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
        params: c.loan ? {
          amount: c.loan.amount, termYears: c.loan.termYears,
          profile: c.loan.profile, currency: c.loan.currency,
          rateMode: c.loan.rateMode, customMonthlyRate: c.loan.customMonthlyRate,
          startDate: c.loan.startDate ?? '',
        } : null,
        result: c.loan ? {
          monthlyPayment: c.loan.monthlyPayment, totalPayment: c.loan.totalPayment,
          totalInterest: c.loan.totalInterest, annualRate: c.loan.annualRate,
          monthlyRate: c.loan.monthlyRate, totalMonths: c.loan.totalMonths,
          interestRatio: c.loan.interestRatio,
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

// ─── DELETE /api/clients/[id] ─────────────────────────────────────────────────
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

    // Only delete if it belongs to this org (prevents cross-tenant deletes)
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

// ─── PATCH /api/clients/[id] — update status or client info ─────────────────
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

    // ── Loan status ────────────────────────────────────────────────────────────
    if (body.loanStatus !== undefined) {
      if (!['pending', 'approved', 'denied'].includes(body.loanStatus))
        return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
      $set.loanStatus = body.loanStatus
    }

    // ── Client info fields ─────────────────────────────────────────────────────
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

    // ── Branch update (resolve named branch → derive type + name) ──────────────
    if (body.branchId !== undefined) {
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
