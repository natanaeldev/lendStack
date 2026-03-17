// ─── POST /api/admin/loan-policy/evaluate ────────────────────────────────────
// Evaluate a loan application against the active credit policy.
// Body: { credit_score, debt_to_income_ratio, monthly_income, loan_amount, is_employed }
// Requires authentication (any role).

import { NextRequest, NextResponse }        from 'next/server'
import { getDb, isDbConfigured }           from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { evaluateLoanApplication }         from '@/lib/loanPolicy/evaluator'
import type { LoanCreditPolicy, LoanCreditEvaluationInput } from '@/lib/loanPolicy/types'

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body = await req.json()
    const { credit_score, debt_to_income_ratio, monthly_income, loan_amount, is_employed } = body

    if (credit_score === undefined || debt_to_income_ratio === undefined ||
        monthly_income === undefined || loan_amount === undefined || is_employed === undefined) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos: credit_score, debt_to_income_ratio, monthly_income, loan_amount, is_employed' },
        { status: 400 },
      )
    }

    const db    = await getDb()
    const orgId = session.user.organizationId

    const policy = await db
      .collection<LoanCreditPolicy>('loan_credit_policies')
      .findOne({ organizationId: orgId, is_active: true }, { sort: { createdAt: -1 } })

    if (!policy) {
      return NextResponse.json({ error: 'No hay una política de crédito activa configurada.' }, { status: 422 })
    }

    const input: LoanCreditEvaluationInput = {
      credit_score:         Number(credit_score),
      debt_to_income_ratio: Number(debt_to_income_ratio),
      monthly_income:       Number(monthly_income),
      loan_amount:          Number(loan_amount),
      is_employed:          Boolean(is_employed),
    }

    const result = evaluateLoanApplication(policy, input)
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    console.error('[POST /api/admin/loan-policy/evaluate]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
