import { NextRequest, NextResponse }                    from 'next/server'
import { getDb, isDbConfigured }                       from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse }           from '@/lib/orgAuth'
import { v4 as uuidv4 }                               from 'uuid'

// ─── GET  /api/clients ────────────────────────────────────────────────────────
export async function GET() {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured())
    return NextResponse.json({ configured: false, clients: [] }, { status: 503 })

  try {
    const db  = await getDb()
    const col = db.collection('clients')

    const records = await col
      .find({ organizationId: session.user.organizationId })
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
      // Estado del préstamo
      loanStatus: c.loanStatus ?? 'pending',
      // Préstamo
      params: c.loan ? {
        amount:            c.loan.amount,
        termYears:         c.loan.termYears,
        profile:           c.loan.profile,
        currency:          c.loan.currency,
        rateMode:          c.loan.rateMode,
        customMonthlyRate: c.loan.customMonthlyRate,
      } : null,
      result: c.loan ? {
        monthlyPayment: c.loan.monthlyPayment,
        totalPayment:   c.loan.totalPayment,
        totalInterest:  c.loan.totalInterest,
        annualRate:     c.loan.annualRate,
        monthlyRate:    c.loan.monthlyRate,
        totalMonths:    c.loan.totalMonths,
        interestRatio:  c.loan.interestRatio,
      } : null,
      documents: c.documents ?? [],
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
      // Loan
      params, result,
    } = body

    if (!name?.trim())
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const clientId = uuidv4()
    const loanId   = uuidv4()
    const savedAt  = new Date().toISOString()

    const db  = await getDb()
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
      // Loan status
      loanStatus: 'pending',
      // Loan
      loan: {
        id:                loanId,
        amount:            params.amount,
        termYears:         params.termYears,
        profile:           params.profile,
        currency:          params.currency,
        rateMode:          params.rateMode          ?? 'annual',
        customMonthlyRate: params.customMonthlyRate ?? 0,
        monthlyPayment:    result.monthlyPayment,
        totalPayment:      result.totalPayment,
        totalInterest:     result.totalInterest,
        annualRate:        result.annualRate,
        monthlyRate:       result.monthlyRate,
        totalMonths:       result.totalMonths,
        interestRatio:     result.interestRatio,
      },
      documents: [],
    })

    return NextResponse.json({ success: true, id: clientId, savedAt })
  } catch (err: any) {
    console.error('[POST /api/clients]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
