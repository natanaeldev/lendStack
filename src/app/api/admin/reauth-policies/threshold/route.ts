// ─── GET/POST /api/admin/reauth-policies/threshold ───────────────────────────
// Manage loan threshold policies. Master-only.

import { NextRequest, NextResponse }               from 'next/server'
import { getDb, isDbConfigured }                  from '@/lib/mongodb'
import { requireMaster, forbiddenResponse }        from '@/lib/orgAuth'
import { v4 as uuid }                             from 'uuid'
import { ensureReauthIndexes }                    from '@/lib/loanReauth/indexes'
import { recordAdminPolicyChange }                from '@/lib/loanReauth/audit'
import type { LoanThresholdPolicy, ThresholdScopeType } from '@/lib/loanReauth/types'

const VALID_SCOPE_TYPES: ThresholdScopeType[] = ['global', 'branch', 'product', 'agent_role', 'agent']

export async function GET(_req: NextRequest) {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db = await getDb()
    await ensureReauthIndexes(db)

    const policies = await db
      .collection<LoanThresholdPolicy>('loan_threshold_policies')
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
    const { scopeType, scopeId, thresholdAmount, currency, active = true } = body

    if (!VALID_SCOPE_TYPES.includes(scopeType)) {
      return NextResponse.json({ error: `scopeType inválido. Valores: ${VALID_SCOPE_TYPES.join(', ')}` }, { status: 400 })
    }
    if (!thresholdAmount || thresholdAmount <= 0) {
      return NextResponse.json({ error: 'thresholdAmount debe ser mayor a 0' }, { status: 400 })
    }
    if (!currency) {
      return NextResponse.json({ error: 'currency es requerido' }, { status: 400 })
    }
    if (scopeType !== 'global' && !scopeId) {
      return NextResponse.json({ error: 'scopeId es requerido para este tipo de alcance' }, { status: 400 })
    }

    const db  = await getDb()
    const now = new Date().toISOString()
    const id  = uuid()
    const orgId = session.user.organizationId

    const policy: LoanThresholdPolicy = {
      _id:            id,
      organizationId: orgId,
      active,
      scopeType,
      scopeId:        scopeType === 'global' ? null : scopeId,
      thresholdAmount: Number(thresholdAmount),
      currency:       String(currency).toUpperCase(),
      createdAt:      now,
      updatedAt:      now,
      createdBy:      session.user.id,
    }

    await db.collection('loan_threshold_policies').insertOne(policy as any)
    await recordAdminPolicyChange(db, {
      organizationId: orgId,
      policyType:  'threshold',
      policyId:    id,
      changedBy:   session.user.id,
      beforeData:  null,
      afterData:   policy as unknown as Record<string, unknown>,
    })

    return NextResponse.json({ success: true, policy })
  } catch (err: any) {
    console.error('[POST /api/admin/reauth-policies/threshold]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
