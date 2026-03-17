import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { inferLegacyInterestMethod, inferLegacyPaymentFrequency, type InterestMethod } from '@/lib/loan'
import { buildLoanChargeDocs, normalizeLoanCharges, summarizeLoanCharges } from '@/lib/loanCharges'
import { emitNotification }                 from '@/lib/notifications'
import { v4 as uuidv4 }                      from 'uuid'
import { evaluateThreshold }                from '@/lib/loanReauth/threshold'
import { recordLoanAudit }                  from '@/lib/loanReauth/audit'
import { ensureReauthIndexes }              from '@/lib/loanReauth/indexes'


function inferLoanType(loan: any, clientLoan?: any): 'amortized' | 'weekly' | 'carrito' {
  const normalize = (value: any) => String(value ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_')

  const explicit = normalize(loan?.loanType)
  if (explicit === 'weekly') return 'weekly'
  if (['carrito', 'flat', 'flat_rate', 'interes_plano'].includes(explicit)) return 'carrito'

  const hasWeeklySignals =
    loan?.termWeeks != null || loan?.weeklyRate != null || loan?.totalWeeks != null
  if (hasWeeklySignals) return 'weekly'

  const hasCarritoSignals =
    loan?.flatRate != null || loan?.carritoTerm != null || loan?.carritoPayments != null || loan?.numPayments != null || loan?.carritoFrequency != null || loan?.frequency != null
  if (hasCarritoSignals) return 'carrito'

  const clientType = normalize(clientLoan?.loanType)
  if (clientType === 'weekly') return 'weekly'
  if (['carrito', 'flat', 'flat_rate', 'interes_plano'].includes(clientType)) return 'carrito'

  const clientHasWeeklySignals = clientLoan?.termWeeks != null || clientLoan?.weeklyRate != null || clientLoan?.weeklyPayment != null
  if (clientHasWeeklySignals) return 'weekly'

  const clientHasCarritoSignals =
    clientLoan?.flatRate != null || clientLoan?.carritoTerm != null || clientLoan?.numPayments != null || clientLoan?.frequency != null || clientLoan?.fixedPayment != null
  if (clientHasCarritoSignals) return 'carrito'

  return 'amortized'
}


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
      _id:           String(l._id),
      loanType:      inferLoanType(l, clientMap[l.clientId]?.loan),
      borrowerName:  clientMap[l.clientId]?.name ?? '—',
      borrowerPhone: clientMap[l.clientId]?.phone ?? '',
      interestMethod: l.interestMethod ?? inferLegacyInterestMethod(l.loanType, l.interestMethod),
      paymentFrequency: l.paymentFrequency ?? inferLegacyPaymentFrequency(l.loanType, l.carritoFrequency),
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
      totalFinancedAmount,
      netDisbursedAmount,
      loanCharges,
      charges,
      termYears,
      termWeeks,
      carritoTerm,
      carritoPayments,
      carritoFrequency,
      profile,
      rateMode,
      customMonthlyRate,
      interestMethod,
      paymentFrequency,
      installmentCount,
      interestPeriodCount,
      rateValue,
      rateUnit,
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

    const normalizedLoanType = inferLoanType({
      loanType,
      termWeeks,
      weeklyRate,
      totalWeeks,
      carritoTerm,
      carritoPayments,
      carritoFrequency,
    }, client.loan)

    const resolvedInterestMethod = interestMethod ?? inferLegacyInterestMethod(normalizedLoanType, interestMethod)
    const resolvedPaymentFrequency = paymentFrequency ?? inferLegacyPaymentFrequency(normalizedLoanType, carritoFrequency)
    const normalizedCharges = normalizeLoanCharges(loanCharges ?? charges)
    const chargeSummary = summarizeLoanCharges(Number(amount), normalizedCharges)
    const resolvedInstallmentCount =
      installmentCount ??
      (normalizedLoanType === 'amortized'
        ? totalMonths
        : normalizedLoanType === 'weekly'
          ? totalWeeks ?? termWeeks
          : carritoPayments)
    const scheduleGenerationMethod =
      resolvedInterestMethod === 'DECLINING_BALANCE'
        ? 'DECLINING_BALANCE_LAST_PAYMENT_ADJUSTMENT'
        : resolvedInterestMethod === 'INTEREST_ONLY'
          ? 'INTEREST_ONLY_BALLOON'
          : resolvedInterestMethod === 'ZERO_INTEREST'
            ? 'ZERO_INTEREST_LAST_ADJUSTMENT'
            : 'EQUAL_INSTALLMENT_LAST_ADJUSTMENT'

    const now    = new Date().toISOString()
    const loanId = uuidv4()

    const loanDoc = {
      _id:            loanId,
      organizationId: orgId,
      clientId,
      status:         'application_submitted',
      createdAt:      now,
      updatedAt:      now,
      loanType: normalizedLoanType,
      currency,
      amount,
      totalFinancedAmount: normalizedCharges.length > 0 ? chargeSummary.totalFinancedAmount : totalFinancedAmount ?? undefined,
      netDisbursedAmount:  normalizedCharges.length > 0 ? chargeSummary.netDisbursedAmount : netDisbursedAmount ?? undefined,
      termYears:         termYears         ?? undefined,
      termWeeks:         termWeeks         ?? undefined,
      carritoTerm:       carritoTerm       ?? undefined,
      carritoPayments:   carritoPayments   ?? undefined,
      carritoFrequency:  carritoFrequency  ?? undefined,
      profile:           profile           ?? undefined,
      rateMode:          rateMode          ?? 'annual',
      customMonthlyRate: customMonthlyRate ?? undefined,
      interestMethod:    resolvedInterestMethod as InterestMethod,
      scheduleGenerationMethod,
      paymentFrequency:  resolvedPaymentFrequency,
      installmentCount:  resolvedInstallmentCount ?? undefined,
      interestPeriodCount: interestPeriodCount ?? undefined,
      rateValue:         rateValue ?? undefined,
      rateUnit:          rateUnit ?? 'DECIMAL',
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
      remainingBalance: totalPayment ?? amount,
      notes:           notes ?? undefined,
    }

    // ── Threshold evaluation for existing customers ───────────────────────────
    // Only applies when clientId refers to an existing client (not a new intake)
    let reauthRequired = false
    let thresholdResult = null
    const isExistingCustomer = Boolean(client)

    if (isExistingCustomer) {
      await ensureReauthIndexes(db)
      thresholdResult = await evaluateThreshold(db, {
        organizationId: orgId,
        agentId:    session.user.id,
        agentRole:  session.user.role ?? session.user.organizationRole ?? 'user',
        requestedAmount: Number(amount),
        currency:   String(currency),
      })

      if (thresholdResult.exceeded) {
        reauthRequired = true
        Object.assign(loanDoc, {
          requiresReauth:           true,
          reauthStatus:             'REAUTH_REQUIRED',
          status:                   'reauth_required',
          disbursementLocked:       true,
          triggeredPolicyId:        thresholdResult.applicablePolicy?._id ?? null,
          triggeredThresholdAmount: thresholdResult.thresholdAmount,
        })
      }
    }

    await db.collection('loans').insertOne(loanDoc as any)
    if (normalizedCharges.length > 0) {
      await db.collection('loan_charges').insertMany(
        buildLoanChargeDocs(loanId, orgId, normalizedCharges, now) as any[],
      )
    }

    // Audit: loan created
    await recordLoanAudit(db, {
      organizationId: orgId,
      loanId,
      customerId: String(client._id),
      actor: { actorId: session.user.id, actorRole: session.user.role ?? 'user' },
      eventType: 'loan_created',
      eventPayload: { amount, currency, clientId },
    })

    if (reauthRequired && thresholdResult) {
      await recordLoanAudit(db, {
        organizationId: orgId,
        loanId,
        customerId: String(client._id),
        actor: { actorId: session.user.id, actorRole: session.user.role ?? 'user' },
        eventType: 'threshold_exceeded',
        eventPayload: {
          requestedAmount: thresholdResult.requestedAmount,
          thresholdAmount: thresholdResult.thresholdAmount,
          policyId:        thresholdResult.applicablePolicy?._id ?? null,
        },
      })
    }

    const amountLabel = new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount))

    await emitNotification(db, {
      tenantId: orgId,
      actorUserId: session.user.id,
      type: 'loan.created',
      entityType: 'loan',
      entityId: loanId,
      actionUrl: `/app/prestamos?loanId=${loanId}`,
      message: `${client.name ?? 'Cliente'} registró una solicitud por ${amountLabel}.`,
      metadata: {
        clientId,
        clientName: client.name ?? 'Cliente',
        currency,
        amount,
      },
    })

    const clientDocuments = Array.isArray(client.documents) ? client.documents : []
    if (clientDocuments.length === 0) {
      await emitNotification(db, {
        tenantId: orgId,
        actorUserId: session.user.id,
        type: 'document.missing',
        entityType: 'client',
        entityId: String(client._id),
        actionUrl: `/app/clientes?clientId=${String(client._id)}`,
        message: `${client.name ?? 'Cliente'} no tiene documentación cargada para completar el expediente.`,
        metadata: {
          clientId: String(client._id),
          clientName: client.name ?? 'Cliente',
          loanId,
        },
      })
    }

    if (!client.hasIncomeProof || clientDocuments.length === 0) {
      await emitNotification(db, {
        tenantId: orgId,
        actorUserId: session.user.id,
        type: 'manual_review.required',
        entityType: 'loan',
        entityId: loanId,
        actionUrl: `/app/prestamos?loanId=${loanId}`,
        message: `${client.name ?? 'Cliente'} requiere revisión manual antes de avanzar con la evaluación.`,
        metadata: {
          clientId: String(client._id),
          clientName: client.name ?? 'Cliente',
          loanId,
          missingIncomeProof: !client.hasIncomeProof,
          missingDocuments: clientDocuments.length === 0,
        },
      })
    }

    return NextResponse.json({
      success: true,
      loanId,
      reauthRequired,
      thresholdAmount: thresholdResult?.thresholdAmount ?? null,
      thresholdExceeded: thresholdResult?.exceeded ?? false,
    })
  } catch (err: any) {
    console.error('[POST /api/loans]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
