import { NextRequest, NextResponse } from 'next/server'
import type { BillingProductKey, BillingPlanInterval } from '@/lib/billingPlans'
import { getMongoClient, getDb, isDbConfigured } from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { runSelfServiceOnboarding } from '@/lib/selfServiceOnboarding'
import { handleCreateOrganization } from '@/lib/organizationApi'

/**
 * POST /api/organizations
 *
 * Creates an organization for the currently-authenticated user.
 * Does NOT create a Stripe checkout — that is handled separately by
 * POST /api/billing/checkout once the user has selected a plan.
 *
 * Body: { orgName, adminName? }
 * Returns: { organizationId, organizationSlug, needsPlanSelection: true }
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const client = await getMongoClient()
    const db = await getDb()

    const result = await handleCreateOrganization(
      body,
      {
        runSelfServiceOnboarding: (input) => runSelfServiceOnboarding(client, db, input as any),

        // Recovery: if the user already has a pending-checkout org (e.g., they came
        // back after abandoning plan selection), return it instead of creating a new one.
        findPendingCheckoutByOrgId: async (orgId: string) => {
          const org = await db.collection('organizations').findOne({
            _id: orgId as any,
            billingStatus: 'pending_checkout',
          })
          if (!org) return null
          return {
            organizationId: String(org._id),
            userId: session.user.id,
            planKey: (org.billingPlan ?? 'pro') as BillingProductKey,
            interval: (org.billingInterval ?? 'month') as BillingPlanInterval,
          }
        },
      },
      {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        organizationId: session.user.organizationId,
      },
    )

    if (result.status >= 400) {
      console.warn('[POST /api/organizations] error', {
        userId: session.user.id,
        errorCode: result.body.errorCode,
        message: result.body.error,
      })
    }

    return NextResponse.json(result.body, { status: result.status })
  } catch (error: any) {
    console.error('[POST /api/organizations]', error)
    return NextResponse.json({ error: 'No se pudo crear la organización.' }, { status: 500 })
  }
}
