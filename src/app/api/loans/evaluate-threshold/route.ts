// ─── GET /api/loans/evaluate-threshold?amount=X&currency=Y ───────────────────
// Evaluate whether a loan amount would trigger the reauth flow.
// Used by the frontend before creating the loan.

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { evaluateThreshold }                 from '@/lib/loanReauth/threshold'
import { ensureReauthIndexes }               from '@/lib/loanReauth/indexes'

export async function GET(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const { searchParams } = new URL(req.url)
    const amount   = parseFloat(searchParams.get('amount') ?? '0')
    const currency = searchParams.get('currency') ?? 'DOP'

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'amount debe ser mayor a 0' }, { status: 400 })
    }

    const db = await getDb()
    await ensureReauthIndexes(db)

    const result = await evaluateThreshold(db, {
      organizationId: session.user.organizationId,
      agentId:    session.user.id,
      agentRole:  session.user.role ?? session.user.organizationRole ?? 'user',
      requestedAmount: amount,
      currency,
    })

    return NextResponse.json({
      exceeded:        result.exceeded,
      thresholdAmount: result.thresholdAmount === Infinity ? null : result.thresholdAmount,
      currency:        result.currency,
      requestedAmount: result.requestedAmount,
      policyId:        result.applicablePolicy?._id ?? null,
    })
  } catch (err: any) {
    console.error('[GET /api/loans/evaluate-threshold]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
