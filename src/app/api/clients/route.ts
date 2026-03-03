import { NextRequest, NextResponse } from 'next/server'
import { getDb, isDbConfigured } from '@/lib/mongodb'
import { v4 as uuidv4 } from 'uuid'

// ─── GET  /api/clients ────────────────────────────────────────────────────────
export async function GET() {
  if (!isDbConfigured())
    return NextResponse.json({ configured: false, clients: [] }, { status: 503 })

  try {
    const db  = await getDb()
    const col = db.collection('clients')

    const records = await col
      .find({})
      .sort({ savedAt: -1 })
      .toArray()

    const clients = records.map(c => ({
      id:      String(c._id),
      name:    c.name,
      email:   c.email,
      phone:   c.phone,
      notes:   c.notes,
      savedAt: c.savedAt,
      params: c.loan
        ? {
            amount:           c.loan.amount,
            termYears:        c.loan.termYears,
            profile:          c.loan.profile,
            currency:         c.loan.currency,
            rateMode:         c.loan.rateMode,
            customMonthlyRate:c.loan.customMonthlyRate,
          }
        : null,
      result: c.loan
        ? {
            monthlyPayment: c.loan.monthlyPayment,
            totalPayment:   c.loan.totalPayment,
            totalInterest:  c.loan.totalInterest,
            annualRate:     c.loan.annualRate,
            monthlyRate:    c.loan.monthlyRate,
            totalMonths:    c.loan.totalMonths,
            interestRatio:  c.loan.interestRatio,
          }
        : null,
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
  if (!isDbConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const { name, email, phone, notes, params, result } = await req.json()
    if (!name?.trim())
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const clientId = uuidv4()
    const loanId   = uuidv4()
    const savedAt  = new Date().toISOString()

    const db  = await getDb()
    const col = db.collection('clients')

    await col.insertOne({
      _id: clientId as any,
      name:    name.trim(),
      email:   email?.trim()  ?? '',
      phone:   phone?.trim()  ?? '',
      notes:   notes?.trim()  ?? '',
      savedAt,
      loan: {
        id:               loanId,
        amount:           params.amount,
        termYears:        params.termYears,
        profile:          params.profile,
        currency:         params.currency,
        rateMode:         params.rateMode        ?? 'annual',
        customMonthlyRate:params.customMonthlyRate ?? 0,
        monthlyPayment:   result.monthlyPayment,
        totalPayment:     result.totalPayment,
        totalInterest:    result.totalInterest,
        annualRate:       result.annualRate,
        monthlyRate:      result.monthlyRate,
        totalMonths:      result.totalMonths,
        interestRatio:    result.interestRatio,
      },
      documents: [],
    })

    return NextResponse.json({ success: true, id: clientId, savedAt })
  } catch (err: any) {
    console.error('[POST /api/clients]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
