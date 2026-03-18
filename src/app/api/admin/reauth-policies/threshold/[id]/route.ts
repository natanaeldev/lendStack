// ─── PATCH/DELETE /api/admin/reauth-policies/threshold/[id] ──────────────────

import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireMaster, forbiddenResponse }  from '@/lib/orgAuth'
import { recordAdminPolicyChange }           from '@/lib/loanReauth/audit'

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

    const existing = await db.collection('loan_threshold_policies').findOne({
      _id: params.id as any, organizationId: orgId,
    })
    if (!existing) return NextResponse.json({ error: 'Política no encontrada' }, { status: 404 })

    const $set: Record<string, any> = { updatedAt: new Date().toISOString() }
    if (body.active !== undefined) $set.active = Boolean(body.active)
    if (body.thresholdAmount) $set.thresholdAmount = Number(body.thresholdAmount)
    if (body.currency) $set.currency = String(body.currency).toUpperCase()
    if (body.scopeType) $set.scopeType = body.scopeType
    if (body.scopeId !== undefined) $set.scopeId = body.scopeId

    await db.collection('loan_threshold_policies').updateOne(
      { _id: params.id as any, organizationId: orgId },
      { $set },
    )

    await recordAdminPolicyChange(db, {
      organizationId: orgId,
      policyType:  'threshold',
      policyId:    params.id,
      changedBy:   session.user.id,
      beforeData:  existing as unknown as Record<string, unknown>,
      afterData:   { ...existing, ...$set } as Record<string, unknown>,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
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

    const existing = await db.collection('loan_threshold_policies').findOne({ _id: params.id as any, organizationId: orgId })
    if (!existing) return NextResponse.json({ error: 'Política no encontrada' }, { status: 404 })

    // Soft delete — just mark inactive
    await db.collection('loan_threshold_policies').updateOne(
      { _id: params.id as any, organizationId: orgId },
      { $set: { active: false, updatedAt: new Date().toISOString() } },
    )

    await recordAdminPolicyChange(db, {
      organizationId: orgId,
      policyType:  'threshold',
      policyId:    params.id,
      changedBy:   session.user.id,
      beforeData:  existing as unknown as Record<string, unknown>,
      afterData:   { ...existing, active: false } as Record<string, unknown>,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
