import { NextRequest, NextResponse } from 'next/server'
import { runQuery, isNeo4jConfigured } from '@/lib/neo4j'
import { v4 as uuidv4 } from 'uuid'

// ─── GET  /api/clients ────────────────────────────────────────────────────────
export async function GET() {
  if (!isNeo4jConfigured())
    return NextResponse.json({ configured: false, clients: [] }, { status: 503 })

  try {
    const records = await runQuery(`
      MATCH (c:Client)-[:HAS_LOAN]->(l:Loan)
      OPTIONAL MATCH (c)-[:HAS_DOCUMENT]->(d:Document)
      WITH c, l,
           collect(CASE WHEN d IS NOT NULL THEN {
             id: d.id, name: d.name, url: d.url,
             type: d.type, size: d.size, uploadedAt: d.uploadedAt
           } END) AS docs
      RETURN {
        id: c.id, name: c.name, email: c.email,
        phone: c.phone, notes: c.notes, savedAt: c.savedAt,
        params: {
          amount: l.amount, termYears: l.termYears, profile: l.profile,
          currency: l.currency, rateMode: l.rateMode,
          customMonthlyRate: l.customMonthlyRate
        },
        result: {
          monthlyPayment: l.monthlyPayment, totalPayment: l.totalPayment,
          totalInterest: l.totalInterest, annualRate: l.annualRate,
          monthlyRate: l.monthlyRate, totalMonths: l.totalMonths,
          interestRatio: l.interestRatio
        },
        documents: [doc IN docs WHERE doc IS NOT NULL]
      } AS client
      ORDER BY c.savedAt DESC
    `)

    return NextResponse.json({ clients: records.map(r => r.client) })
  } catch (err: any) {
    console.error('[GET /api/clients]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── POST /api/clients ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isNeo4jConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const { name, email, phone, notes, params, result } = await req.json()
    if (!name?.trim())
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const clientId  = uuidv4()
    const loanId    = uuidv4()
    const savedAt   = new Date().toISOString()

    await runQuery(`
      CREATE (:Client {
        id: $clientId, name: $name, email: $email,
        phone: $phone, notes: $notes, savedAt: $savedAt
      })-[:HAS_LOAN]->(:Loan {
        id: $loanId,
        amount: $amount, termYears: $termYears, profile: $profile,
        currency: $currency, rateMode: $rateMode,
        customMonthlyRate: $customMonthlyRate,
        monthlyPayment: $monthlyPayment, totalPayment: $totalPayment,
        totalInterest: $totalInterest, annualRate: $annualRate,
        monthlyRate: $monthlyRate, totalMonths: $totalMonths,
        interestRatio: $interestRatio
      })
    `, {
      clientId, loanId, savedAt,
      name:            name.trim(),
      email:           email?.trim()   ?? '',
      phone:           phone?.trim()   ?? '',
      notes:           notes?.trim()   ?? '',
      amount:          params.amount,
      termYears:       params.termYears,
      profile:         params.profile,
      currency:        params.currency,
      rateMode:        params.rateMode        ?? 'annual',
      customMonthlyRate: params.customMonthlyRate ?? 0,
      monthlyPayment:  result.monthlyPayment,
      totalPayment:    result.totalPayment,
      totalInterest:   result.totalInterest,
      annualRate:      result.annualRate,
      monthlyRate:     result.monthlyRate,
      totalMonths:     result.totalMonths,
      interestRatio:   result.interestRatio,
    })

    return NextResponse.json({ success: true, id: clientId, savedAt })
  } catch (err: any) {
    console.error('[POST /api/clients]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
