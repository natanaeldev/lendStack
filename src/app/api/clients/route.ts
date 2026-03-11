import { NextRequest, NextResponse }                    from 'next/server'
import { getDb, isDbConfigured }                       from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse }           from '@/lib/orgAuth'
import { migrateLegacyStatus }                         from '@/lib/loanDomain'
import { ObjectId }                                    from 'mongodb'
import { v4 as uuidv4 }                               from 'uuid'

// Starter plan: max 50 clients
const STARTER_CLIENT_LIMIT = 50

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


// ─── GET  /api/clients ────────────────────────────────────────────────────────
export async function GET() {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured())
    return NextResponse.json({ configured: false, clients: [] }, { status: 503 })

  try {
    const db  = await getDb()
    const col = db.collection('clients')

    // ── Branch access control ─────────────────────────────────────────────────
    // master sees all; manager/operator see only their allowedBranchIds (if set)
    const query: Record<string, any> = { organizationId: session.user.organizationId }

    if (session.user.role !== 'master') {
      // Look up user's allowedBranchIds from DB (not cached in JWT)
      let userDoc: any = null
      try {
        let uid: any
        try { uid = new ObjectId(session.user.id) } catch { uid = session.user.id }
        userDoc = await db.collection('users').findOne({ _id: uid })
      } catch { /* ignore */ }

      const allowed: string[] | null = userDoc?.allowedBranchIds ?? null
      if (Array.isArray(allowed) && allowed.length > 0) {
        query.branchId = { $in: allowed }
      }
    }

    const records = await col
      .find(query)
      .sort({ savedAt: -1 })
      .toArray()

    const clients = records.map(c => ({
      id:      String(c._id),
      savedAt: c.savedAt,
      // Sección 1 – Información Personal
      name:        c.name,
      email:       c.email        ?? '',
      phone:       c.phone        ?? '',
      idType:      c.idType       ?? 'DNI',
      idNumber:    c.idNumber     ?? '',
      birthDate:   c.birthDate    ?? '',
      nationality: c.nationality  ?? '',
      address:     c.address      ?? '',
      // Sección 2 – Información Financiera
      occupation:      c.occupation      ?? '',
      monthlyIncome:   c.monthlyIncome   ?? '',
      hasIncomeProof:  c.hasIncomeProof  ?? false,
      currentDebts:    c.currentDebts    ?? '',
      totalDebtValue:  c.totalDebtValue  ?? '',
      paymentCapacity: c.paymentCapacity ?? '',
      // Sección 3 – Garantías y Arraigo
      collateral:      c.collateral      ?? '',
      territorialTies: c.territorialTies ?? '',
      // Sección 4 – Historial y Referencias
      creditHistory: c.creditHistory ?? '',
      reference1:    c.reference1    ?? '',
      reference2:    c.reference2    ?? '',
      notes:         c.notes         ?? '',
      // Sucursal
      branch:     c.branch     ?? null,
      branchId:   c.branchId   ?? null,
      branchName: c.branchName ?? null,
      // Estado del préstamo (legacy 3-value + full lifecycle)
      loanStatus:      c.loanStatus ?? 'pending',
      lifecycleStatus: migrateLegacyStatus(c.loanStatus),
      loanId:          c.loan?.id ?? null,
      // Tipo de préstamo
      loanType: inferLoanType(c.loan),
      // Préstamo
      params: c.loan ? {
        amount:            c.loan.amount,
        termYears:         c.loan.termYears        ?? null,
        profile:           c.loan.profile,
        currency:          c.loan.currency,
        rateMode:          c.loan.rateMode          ?? 'annual',
        customMonthlyRate: c.loan.customMonthlyRate ?? 0,
        startDate:         c.loan.startDate         ?? '',
        // weekly extras
        termWeeks:   c.loan.termWeeks   ?? null,
        monthlyRate: c.loan.monthlyRate ?? null,
        // carrito extras
        flatRate:    c.loan.flatRate    ?? null,
        carritoTerm: c.loan.carritoTerm ?? null,
        numPayments: c.loan.numPayments ?? null,
        frequency:   c.loan.frequency   ?? null,
      } : null,
      result: c.loan ? {
        monthlyPayment: c.loan.monthlyPayment,
        totalPayment:   c.loan.totalPayment,
        totalInterest:  c.loan.totalInterest,
        annualRate:     c.loan.annualRate     ?? 0,
        monthlyRate:    c.loan.monthlyRate    ?? 0,
        totalMonths:    c.loan.totalMonths    ?? null,
        interestRatio:  c.loan.interestRatio,
        // weekly extras
        weeklyPayment: c.loan.weeklyPayment ?? null,
        weeklyRate:    c.loan.weeklyRate    ?? null,
        totalWeeks:    c.loan.termWeeks     ?? null,
        // carrito extras
        fixedPayment: c.loan.fixedPayment ?? null,
        numPayments:  c.loan.numPayments  ?? null,
      } : null,
      documents: c.documents ?? [],
      payments:  c.payments  ?? [],
    }))

    return NextResponse.json({ clients })
  } catch (err: any) {
    console.error('[GET /api/clients]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── POST /api/clients ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body = await req.json()
    const {
      // Section 1 – Personal
      name, email, phone,
      idType, idNumber, birthDate, nationality, address,
      // Section 2 – Financial
      occupation, monthlyIncome, hasIncomeProof,
      currentDebts, totalDebtValue, paymentCapacity,
      // Section 3 – Collateral
      collateral, territorialTies,
      // Section 4 – History & References
      creditHistory, reference1, reference2, notes,
      // Branch
      branchId,
      // Loan
      loanType = 'amortized',
      params,
      result,
      weeklyParams,
      carritoParams,
    } = body

    if (!name?.trim())
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    if (!branchId)
      return NextResponse.json({ error: 'Branch is required' }, { status: 400 })

    // ── Plan limit check ──────────────────────────────────────────────────────
    const db = await getDb()

    const org = await db.collection('organizations').findOne({
      _id: session.user.organizationId as any,
    })
    const orgPlan = (org?.plan as string | undefined) ?? 'starter'

    if (orgPlan === 'starter') {
      const clientCount = await db.collection('clients').countDocuments({
        organizationId: session.user.organizationId,
      })
      if (clientCount >= STARTER_CLIENT_LIMIT) {
        return NextResponse.json(
          {
            error:       `Límite del plan Starter alcanzado (${STARTER_CLIENT_LIMIT} clientes).`,
            planLimited: true,
          },
          { status: 403 }
        )
      }
    }

    const clientId = uuidv4()
    const loanId   = uuidv4()
    const savedAt  = new Date().toISOString()

    // Resolve named branch → derive type and display name
    const branchDoc = await db.collection('branches').findOne({
      _id:            branchId as any,
      organizationId: session.user.organizationId,
    })
    if (!branchDoc)
      return NextResponse.json({ error: 'Sucursal no encontrada.' }, { status: 404 })

    const branch     = branchDoc.type as string   // 'sede' | 'rutas'
    const branchName = branchDoc.name as string

    // ── Build loan object based on loanType ───────────────────────────────────
    const AVG_WEEKS_PER_MONTH = 4.33
    const AVG_DAYS_PER_MONTH  = 30.44

    let loanDoc: Record<string, any>

    if (loanType === 'weekly' && weeklyParams && result) {
      const { termWeeks, monthlyRate } = weeklyParams
      const effectiveMonthly = result.weeklyPayment * AVG_WEEKS_PER_MONTH
      loanDoc = {
        id:             loanId,
        loanType:       'weekly',
        amount:         params.amount,
        profile:        params.profile         ?? 'Medium Risk',
        currency:       params.currency        ?? 'USD',
        startDate:      params.startDate       ?? '',
        // Weekly-specific
        termWeeks,
        weeklyRate:     result.weeklyRate,
        weeklyPayment:  result.weeklyPayment,
        monthlyRate,
        annualRate:     result.annualRate,
        // Normalised monthly (for reminders / stats)
        monthlyPayment: effectiveMonthly,
        totalMonths:    Math.round(termWeeks / AVG_WEEKS_PER_MONTH),
        totalPayment:   result.totalPayment,
        totalInterest:  result.totalInterest,
        interestRatio:  result.interestRatio,
      }
    } else if (loanType === 'carrito' && carritoParams && result) {
      const { flatRate, term, numPayments, frequency } = carritoParams
      const effectiveMonthly = frequency === 'daily'
        ? result.fixedPayment * AVG_DAYS_PER_MONTH
        : result.fixedPayment * AVG_WEEKS_PER_MONTH
      loanDoc = {
        id:             loanId,
        loanType:       'carrito',
        amount:         params.amount,
        profile:        params.profile   ?? 'Medium Risk',
        currency:       params.currency  ?? 'USD',
        startDate:      params.startDate ?? '',
        // Carrito-specific
        flatRate,
        carritoTerm:    term,
        numPayments,
        frequency,
        fixedPayment:   result.fixedPayment,
        // Normalised monthly (for reminders / stats)
        monthlyPayment: effectiveMonthly,
        totalMonths:    frequency === 'daily'
          ? Math.round(numPayments / AVG_DAYS_PER_MONTH)
          : Math.round(numPayments / AVG_WEEKS_PER_MONTH),
        totalPayment:   result.totalPayment,
        totalInterest:  result.totalInterest,
        interestRatio:  result.interestRatio,
        annualRate:     0,
        monthlyRate:    0,
      }
    } else {
      // Default: amortized
      loanDoc = {
        id:                loanId,
        loanType:          'amortized',
        amount:            params.amount,
        termYears:         params.termYears,
        profile:           params.profile,
        currency:          params.currency,
        rateMode:          params.rateMode          ?? 'annual',
        customMonthlyRate: params.customMonthlyRate ?? 0,
        startDate:         params.startDate         ?? '',
        monthlyPayment:    result.monthlyPayment,
        totalPayment:      result.totalPayment,
        totalInterest:     result.totalInterest,
        annualRate:        result.annualRate,
        monthlyRate:       result.monthlyRate,
        totalMonths:       result.totalMonths,
        interestRatio:     result.interestRatio,
      }
    }

    const col = db.collection('clients')

    await col.insertOne({
      _id:            clientId as any,
      organizationId: session.user.organizationId,
      savedAt,
      // Section 1
      name:        name.trim(),
      email:       email?.trim()       ?? '',
      phone:       phone?.trim()       ?? '',
      idType:      idType?.trim()      ?? 'DNI',
      idNumber:    idNumber?.trim()    ?? '',
      birthDate:   birthDate?.trim()   ?? '',
      nationality: nationality?.trim() ?? '',
      address:     address?.trim()     ?? '',
      // Section 2
      occupation:      occupation?.trim()      ?? '',
      monthlyIncome:   monthlyIncome?.trim()   ?? '',
      hasIncomeProof:  hasIncomeProof          ?? false,
      currentDebts:    currentDebts?.trim()    ?? '',
      totalDebtValue:  totalDebtValue?.trim()  ?? '',
      paymentCapacity: paymentCapacity?.trim() ?? '',
      // Section 3
      collateral:      collateral?.trim()      ?? '',
      territorialTies: territorialTies?.trim() ?? '',
      // Section 4
      creditHistory: creditHistory?.trim() ?? '',
      reference1:    reference1?.trim()    ?? '',
      reference2:    reference2?.trim()    ?? '',
      notes:         notes?.trim()         ?? '',
      // Branch (type for filtering + named branch)
      branch,
      branchId,
      branchName,
      // Loan status
      loanStatus: 'pending',
      // Loan
      loan: loanDoc,
      documents: [],
    })

    // ── Also create a loans collection record for the new lifecycle layer ──────
    if (params && result) {
      await db.collection('loans').insertOne({
        _id:            loanId as any,
        organizationId: session.user.organizationId,
        clientId,
        status:         'application_submitted',
        createdAt:      savedAt,
        updatedAt:      savedAt,
        loanType:       params.loanType ?? 'amortized',
        currency:       params.currency,
        amount:         params.amount,
        termYears:      params.termYears       ?? undefined,
        termWeeks:      params.termWeeks       ?? undefined,
        carritoTerm:    params.carritoTerm     ?? undefined,
        carritoPayments: params.carritoPayments ?? undefined,
        carritoFrequency: params.carritoFrequency ?? undefined,
        profile:        params.profile         ?? undefined,
        rateMode:       params.rateMode        ?? 'annual',
        customMonthlyRate: params.customMonthlyRate ?? undefined,
        annualRate:     result.annualRate      ?? undefined,
        monthlyRate:    result.monthlyRate     ?? undefined,
        totalMonths:    result.totalMonths     ?? undefined,
        scheduledPayment: result.monthlyPayment ?? result.weeklyPayment ?? result.fixedPayment ?? 0,
        totalPayment:   result.totalPayment,
        totalInterest:  result.totalInterest,
        startDate:      params.startDate       ?? undefined,
        paidPrincipal:  0,
        paidInterest:   0,
        paidTotal:      0,
        remainingBalance: params.amount,
      } as any)
    }

    return NextResponse.json({ success: true, id: clientId, loanId, savedAt })
  } catch (err: any) {
    console.error('[POST /api/clients]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
