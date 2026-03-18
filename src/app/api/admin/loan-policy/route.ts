// ─── GET /api/admin/loan-policy  → list policies for org
// ─── POST /api/admin/loan-policy → create a new credit policy
// Master-only.

import { NextRequest, NextResponse }        from 'next/server'
import { getDb, isDbConfigured }           from '@/lib/mongodb'
import { requireMaster, forbiddenResponse } from '@/lib/orgAuth'
import { v4 as uuid }                      from 'uuid'
import type { LoanCreditPolicy }           from '@/lib/loanPolicy/types'

const COLLECTION = 'loan_credit_policies'

export async function GET(_req: NextRequest) {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db = await getDb()
    const policies = await db
      .collection<LoanCreditPolicy>(COLLECTION)
      .find({ organizationId: session.user.organizationId })
      .sort({ createdAt: -1 })
      .toArray()
    return NextResponse.json({ policies })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body = await req.json()
    const {
      policy_name,
      min_credit_score,
      max_debt_to_income_ratio,
      min_monthly_income,
      max_loan_amount,
      employment_required = true,
      rules,
      is_active = true,
    } = body

    // ── Validation ──────────────────────────────────────────────────────────
    if (!policy_name?.trim())
      return NextResponse.json({ error: 'policy_name es requerido' }, { status: 400 })
    if (min_credit_score === undefined || min_credit_score < 0 || min_credit_score > 850)
      return NextResponse.json({ error: 'min_credit_score debe estar entre 0 y 850' }, { status: 400 })
    if (max_debt_to_income_ratio === undefined || max_debt_to_income_ratio < 0 || max_debt_to_income_ratio > 100)
      return NextResponse.json({ error: 'max_debt_to_income_ratio debe estar entre 0 y 100' }, { status: 400 })
    if (min_monthly_income === undefined || min_monthly_income < 0)
      return NextResponse.json({ error: 'min_monthly_income debe ser ≥ 0' }, { status: 400 })
    if (max_loan_amount === undefined || max_loan_amount <= 0)
      return NextResponse.json({ error: 'max_loan_amount debe ser > 0' }, { status: 400 })
    if (!rules?.auto_approve || !rules?.manual_review || !rules?.auto_reject)
      return NextResponse.json({ error: 'rules.auto_approve, rules.manual_review y rules.auto_reject son requeridos' }, { status: 400 })

    // Rules consistency: auto_approve thresholds must be at least as strict as manual_review
    if (rules.auto_approve.credit_score_gte < rules.manual_review.credit_score_gte)
      return NextResponse.json({ error: 'auto_approve.credit_score_gte debe ser ≥ manual_review.credit_score_gte' }, { status: 400 })
    if (rules.auto_approve.income_gte < rules.manual_review.income_gte)
      return NextResponse.json({ error: 'auto_approve.income_gte debe ser ≥ manual_review.income_gte' }, { status: 400 })
    if (rules.auto_approve.debt_to_income_lte > rules.manual_review.debt_to_income_lte)
      return NextResponse.json({ error: 'auto_approve.debt_to_income_lte debe ser ≤ manual_review.debt_to_income_lte' }, { status: 400 })

    const db     = await getDb()
    const orgId  = session.user.organizationId
    const now    = new Date().toISOString()
    const id     = uuid()

    const policy: LoanCreditPolicy = {
      _id:                      id,
      organizationId:           orgId,
      policy_name:              policy_name.trim(),
      min_credit_score:         Number(min_credit_score),
      max_debt_to_income_ratio: Number(max_debt_to_income_ratio),
      min_monthly_income:       Number(min_monthly_income),
      max_loan_amount:          Number(max_loan_amount),
      employment_required:      Boolean(employment_required),
      rules: {
        auto_approve:  {
          credit_score_gte:    Number(rules.auto_approve.credit_score_gte),
          debt_to_income_lte:  Number(rules.auto_approve.debt_to_income_lte),
          income_gte:          Number(rules.auto_approve.income_gte),
        },
        manual_review: {
          credit_score_gte:    Number(rules.manual_review.credit_score_gte),
          debt_to_income_lte:  Number(rules.manual_review.debt_to_income_lte),
          income_gte:          Number(rules.manual_review.income_gte),
        },
        auto_reject:   {
          credit_score_lt:     Number(rules.auto_reject.credit_score_lt),
          debt_to_income_gt:   Number(rules.auto_reject.debt_to_income_gt),
          income_lt:           Number(rules.auto_reject.income_lt),
        },
      },
      is_active:  Boolean(is_active),
      createdAt:  now,
      updatedAt:  now,
      createdBy:  session.user.id,
    }

    await db.collection(COLLECTION).insertOne(policy as any)
    return NextResponse.json({ success: true, policy })
  } catch (err: any) {
    console.error('[POST /api/admin/loan-policy]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
