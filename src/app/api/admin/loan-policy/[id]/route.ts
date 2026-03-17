// ─── PATCH /api/admin/loan-policy/[id] → update policy
// ─── DELETE /api/admin/loan-policy/[id] → deactivate (soft delete)
// Master-only.

import { NextRequest, NextResponse }        from 'next/server'
import { getDb, isDbConfigured }           from '@/lib/mongodb'
import { requireMaster, forbiddenResponse } from '@/lib/orgAuth'

const COLLECTION = 'loan_credit_policies'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const body  = await req.json()
    const db    = await getDb()
    const orgId = session.user.organizationId
    const now   = new Date().toISOString()

    const existing = await db.collection(COLLECTION).findOne({ _id: params.id as any, organizationId: orgId })
    if (!existing) return NextResponse.json({ error: 'Política no encontrada' }, { status: 404 })

    // Build update — only allow known fields
    const allowed = [
      'policy_name', 'min_credit_score', 'max_debt_to_income_ratio',
      'min_monthly_income', 'max_loan_amount', 'employment_required',
      'rules', 'is_active',
    ]
    const $set: Record<string, unknown> = { updatedAt: now }
    for (const key of allowed) {
      if (body[key] !== undefined) $set[key] = body[key]
    }

    // Rules consistency if rules are being updated
    if (body.rules) {
      const r = body.rules
      if (r.auto_approve && r.manual_review) {
        if (r.auto_approve.credit_score_gte < r.manual_review.credit_score_gte)
          return NextResponse.json({ error: 'auto_approve.credit_score_gte debe ser ≥ manual_review.credit_score_gte' }, { status: 400 })
        if (r.auto_approve.income_gte < r.manual_review.income_gte)
          return NextResponse.json({ error: 'auto_approve.income_gte debe ser ≥ manual_review.income_gte' }, { status: 400 })
        if (r.auto_approve.debt_to_income_lte > r.manual_review.debt_to_income_lte)
          return NextResponse.json({ error: 'auto_approve.debt_to_income_lte debe ser ≤ manual_review.debt_to_income_lte' }, { status: 400 })
      }
    }

    await db.collection(COLLECTION).updateOne(
      { _id: params.id as any, organizationId: orgId },
      { $set },
    )

    const updated = await db.collection(COLLECTION).findOne({ _id: params.id as any })
    return NextResponse.json({ success: true, policy: updated })
  } catch (err: any) {
    console.error('[PATCH /api/admin/loan-policy/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db    = await getDb()
    const orgId = session.user.organizationId

    const existing = await db.collection(COLLECTION).findOne({ _id: params.id as any, organizationId: orgId })
    if (!existing) return NextResponse.json({ error: 'Política no encontrada' }, { status: 404 })

    // Soft delete: mark inactive
    await db.collection(COLLECTION).updateOne(
      { _id: params.id as any, organizationId: orgId },
      { $set: { is_active: false, updatedAt: new Date().toISOString() } },
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE /api/admin/loan-policy/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
