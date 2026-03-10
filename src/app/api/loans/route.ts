import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { migrateLegacyStatus }               from '@/lib/loanDomain'
import { v4 as uuidv4 }                      from 'uuid'

// ─── GET /api/loans — list loans for the org ──────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false, loans: [] }, { status: 503 })

  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')
    const status   = searchParams.get('status')
    const orgId    = session.user.organizationId

    const db    = await getDb()
    const query: Record<string, any> = { organizationId: orgId }
    if (clientId) query.clientId = clientId
    if (status)   query.status   = status

    const loans = await db.collection('loans')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray()

    // For each loan, attach borrower name from clients collection (denormalized)
    const clientIds = Array.from(new Set(loans.map(l => l.clientId)))
    const clients   = clientIds.length
      ? await db.collection('clients').find({ _id: { $in: clientIds } as any }).toArray()
      : []
    const clientMap = Object.fromEntries(clients.map(c => [String(c._id), c]))

    const enriched = loans.map(l => ({
      ...l,
      _id:          String(l._id),
      borrowerName: clientMap[l.clientId]?.name ?? '—',
      borrowerPhone: clientMap[l.clientId]?.phone ?? '',
    }))

    return NextResponse.json({ loans: enriched })
  } catch (err: any) {
    console.error('[GET /api/loans]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── POST /api/loans — create a loan from an existing client ─────────────────
// Body: { clientId, loanType, ...terms }
// The client must belong to the same org.
export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body = await req.json()
    const {
      clientId,
      loanType = 'amortized',
      currency,
      amount,
      termYears,
      termWeeks,
      carritoTerm,
      carritoPayments,
      carritoFrequency,
      profile,
      rateMode,
      customMonthlyRate,
      annualRate,
      monthlyRate,
      weeklyRate,
      totalMonths,
      totalWeeks,
      scheduledPayment,
      totalPayment,
      totalInterest,
      startDate,
      notes,
    } = body

    if (!clientId || !currency || !amount || !scheduledPayment) {
      return NextResponse.json(
        { error: 'clientId, currency, amount, and scheduledPayment are required' },
        { status: 400 },
      )
    }

    const orgId = session.user.organizationId

    const db = await getDb()

    // Verify client belongs to this org
    const client = await db.collection('clients').findOne({
      _id:            clientId as any,
      organizationId: orgId,
    })
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const now    = new Date().toISOString()
    const loanId = uuidv4()

    const loanDoc = {
      _id:            loanId,
      organizationId: orgId,
      clientId,
      status:         'application_submitted',
      createdAt:      now,
      updatedAt:      now,
      loanType,
      currency,
      amount,
      termYears:         termYears         ?? undefined,
      termWeeks:         termWeeks         ?? undefined,
      carritoTerm:       carritoTerm       ?? undefined,
      carritoPayments:   carritoPayments   ?? undefined,
      carritoFrequency:  carritoFrequency  ?? undefined,
      profile:           profile           ?? undefined,
      rateMode:          rateMode          ?? 'annual',
      customMonthlyRate: customMonthlyRate ?? undefined,
      annualRate:        annualRate        ?? undefined,
      monthlyRate:       monthlyRate       ?? undefined,
      weeklyRate:        weeklyRate        ?? undefined,
      totalMonths:       totalMonths       ?? undefined,
      totalWeeks:        totalWeeks        ?? undefined,
      scheduledPayment,
      totalPayment,
      totalInterest,
      startDate:         startDate         ?? undefined,
      paidPrincipal:   0,
      paidInterest:    0,
      paidTotal:       0,
      remainingBalance: amount,
      notes:           notes ?? undefined,
    }

    await db.collection('loans').insertOne(loanDoc as any)

    return NextResponse.json({ success: true, loanId })
  } catch (err: any) {
    console.error('[POST /api/loans]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
