import { NextResponse } from 'next/server'
import { getDb, isDbConfigured } from '@/lib/mongodb'
import { requireMaster, forbiddenResponse } from '@/lib/orgAuth'
import { BRAND } from '@/config/branding'
import { ensureRestructureIndexes } from '@/lib/restructure/indexes'
import { ensureReauthIndexes } from '@/lib/loanReauth/indexes'
import { v4 as uuid } from 'uuid'

const ORG_ID = 'org_001'
const ORG_NAME = BRAND.company

export async function POST() {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })
  }

  try {
    const db = await getDb()
    const orgsCol = db.collection('organizations')
    const existingOrg = await orgsCol.findOne({ _id: ORG_ID as any })
    let orgCreated = false

    if (!existingOrg) {
      const now = new Date().toISOString()
      await orgsCol.insertOne({
        _id: ORG_ID as any,
        name: ORG_NAME,
        plan: 'starter',
        createdAt: now,
        updatedAt: now,
      })
      orgCreated = true
    }

    const usersResult = await db.collection('users').updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: ORG_ID } },
    )

    const clientsResult = await db.collection('clients').updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: ORG_ID } },
    )

    // Ensure restructure module indexes exist
    await ensureRestructureIndexes(db)

    // Ensure reauth module indexes and seed default policies
    await ensureReauthIndexes(db)
    const now = new Date().toISOString()

    const existingThreshold = await db.collection('loan_threshold_policies').findOne({ organizationId: ORG_ID, scopeType: 'global' })
    let thresholdSeeded = false
    if (!existingThreshold) {
      await db.collection('loan_threshold_policies').insertOne({
        _id:            uuid(),
        organizationId: ORG_ID,
        active:         true,
        scopeType:      'global',
        scopeId:        null,
        thresholdAmount: 500000,
        currency:       'DOP',
        createdAt:      now,
        updatedAt:      now,
        createdBy:      'seed',
      } as any)
      thresholdSeeded = true
    }

    const existingApproval = await db.collection('loan_approval_policies').findOne({ organizationId: ORG_ID })
    let approvalSeeded = false
    if (!existingApproval) {
      await db.collection('loan_approval_policies').insertOne({
        _id:            uuid(),
        organizationId: ORG_ID,
        name:           'Aprobación estándar de gerencia',
        active:         true,
        scopeType:      'global',
        scopeId:        null,
        minAmount:      500000,
        maxAmount:      null,
        currency:       'DOP',
        approvalMode:   'all_required',
        requiredApprovalCount: 1,
        rejectionMode:  'terminal',
        approvers:      [{ type: 'manager' }],
        biometricMode:  'either',
        retryLimit:     3,
        notificationChannels: ['inApp'],
        secondThresholdAmount: null,
        createdAt:      now,
        updatedAt:      now,
        createdBy:      'seed',
      } as any)
      approvalSeeded = true
    }

    return NextResponse.json({
      success: true,
      orgCreated,
      orgId: ORG_ID,
      orgName: ORG_NAME,
      usersUpdated: usersResult.modifiedCount,
      clientsUpdated: clientsResult.modifiedCount,
      reauthPoliciesSeeded: { threshold: thresholdSeeded, approval: approvalSeeded },
    })
  } catch (err: any) {
    console.error('[POST /api/seed]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
