// ─── GET/POST /api/admin/reauth-policies/approval ────────────────────────────
// Manage loan approval policies. Master-only.

import { NextRequest, NextResponse }               from 'next/server'
import { getDb, isDbConfigured }                  from '@/lib/mongodb'
import { requireMaster, forbiddenResponse }        from '@/lib/orgAuth'
import { v4 as uuid }                             from 'uuid'
import { ensureReauthIndexes }                    from '@/lib/loanReauth/indexes'
import { recordAdminPolicyChange }                from '@/lib/loanReauth/audit'
import type { LoanApprovalPolicy } from '@/lib/loanReauth/types'

export async function GET(_req: NextRequest) {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db = await getDb()
    await ensureReauthIndexes(db)
    const policies = await db
      .collection<LoanApprovalPolicy>('loan_approval_policies')
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
      name, scopeType = 'global', scopeId = null,
      minAmount, maxAmount = null, currency,
      approvalMode = 'all_required', requiredApprovalCount = 1,
      rejectionMode = 'terminal', approvers = [],
      biometricMode = 'either', retryLimit = 3,
      notificationChannels = ['inApp'],
      secondThresholdAmount = null,
      active = true,
    } = body

    if (!name?.trim()) return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
    if (minAmount === undefined) return NextResponse.json({ error: 'minAmount es requerido' }, { status: 400 })
    if (!currency) return NextResponse.json({ error: 'currency es requerido' }, { status: 400 })
    if (!approvers.length) return NextResponse.json({ error: 'Se requiere al menos un aprobador' }, { status: 400 })

    const db  = await getDb()
    const now = new Date().toISOString()
    const id  = uuid()
    const orgId = session.user.organizationId

    const policy: LoanApprovalPolicy = {
      _id:            id,
      organizationId: orgId,
      name:           name.trim(),
      active,
      scopeType,
      scopeId,
      minAmount:      Number(minAmount),
      maxAmount:      maxAmount !== null ? Number(maxAmount) : null,
      currency:       String(currency).toUpperCase(),
      approvalMode,
      requiredApprovalCount: Number(requiredApprovalCount),
      rejectionMode,
      approvers,
      biometricMode,
      retryLimit:     Number(retryLimit),
      notificationChannels,
      secondThresholdAmount: secondThresholdAmount !== null ? Number(secondThresholdAmount) : null,
      createdAt:      now,
      updatedAt:      now,
      createdBy:      session.user.id,
    }

    await db.collection('loan_approval_policies').insertOne(policy as any)
    await recordAdminPolicyChange(db, {
      organizationId: orgId,
      policyType:  'approval',
      policyId:    id,
      changedBy:   session.user.id,
      beforeData:  null,
      afterData:   policy as unknown as Record<string, unknown>,
    })

    return NextResponse.json({ success: true, policy })
  } catch (err: any) {
    console.error('[POST /api/admin/reauth-policies/approval]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
