import { NextRequest, NextResponse } from 'next/server'
import { getBillingPlanByCheckoutKey } from '@/lib/billingPlans'
import type { BillingProductKey, BillingPlanInterval } from '@/lib/billingPlans'
import { getMongoClient, getDb, isDbConfigured } from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { createOrganizationCheckoutSession, isStripeConfigured } from '@/lib/stripeBilling'
import { runSelfServiceOnboarding } from '@/lib/selfServiceOnboarding'
import { handleAuthenticatedOrganizationCreation } from '@/lib/organizationApi'

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

    const result = await handleAuthenticatedOrganizationCreation(
      body,
      {
        getBillingPlanByCheckoutKey,
        isStripeConfigured,
        runSelfServiceOnboarding: (input) => runSelfServiceOnboarding(client, db, input as any),
        createOrganizationCheckoutSession,

        // ── Idempotency: look up a pending-checkout org by email ──
        // Shared base dep — the authenticated handler uses findPendingCheckoutByOrgId
        // for its own retry path, but RegisterDeps requires this to be present.
        findPendingCheckoutRecovery: async (email: string) => {
          const user = await db.collection('users').findOne({ email })
          if (!user) return null
          const org = await db.collection('organizations').findOne({
            _id: user.organizationId as any,
            billingStatus: 'pending_checkout',
          })
          if (!org) return null
          return {
            organizationId: String(org._id),
            userId: String(user._id),
            planKey: (org.billingPlan ?? 'pro') as BillingProductKey,
            interval: (org.billingInterval ?? 'month') as BillingPlanInterval,
          }
        },

        // ── Idempotency: look up a pending-checkout org by its ID ──
        // Handles the authenticated Stripe cancel+retry flow:
        // user registered → Stripe → cancelled → logged in → back to /register.
        // Their organizationId is already in the JWT session; we check if that org
        // is still pending_checkout and re-issue a checkout URL instead of failing.
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

    if (result.status === 409) {
      console.warn('[POST /api/organizations] conflict', {
        userId: session.user.id,
        email: session.user.email,
        errorCode: result.body.errorCode,
        message: result.body.error,
      })
    }

    return NextResponse.json(result.body, { status: result.status })
  } catch (error: any) {
    console.error('[POST /api/organizations]', error)
    return NextResponse.json({ error: 'No se pudo crear la organizacion.' }, { status: 500 })
  }
}
