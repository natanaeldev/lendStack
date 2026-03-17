import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBillingPlanByCheckoutKey } from '@/lib/billingPlans'
import type { BillingProductKey, BillingPlanInterval } from '@/lib/billingPlans'
import { createOrganizationCheckoutSession, isStripeConfigured } from '@/lib/stripeBilling'
import { getDb, getMongoClient, isDbConfigured } from '@/lib/mongodb'
import { runSelfServiceOnboarding } from '@/lib/selfServiceOnboarding'
import { handleRegisterOnboarding } from '@/lib/organizationApi'

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const session = await getServerSession(authOptions)

    const client = await getMongoClient()
    const db = await getDb()

    const result = await handleRegisterOnboarding(
      body,
      {
        getBillingPlanByCheckoutKey,
        isStripeConfigured,
        runSelfServiceOnboarding: (input) => runSelfServiceOnboarding(client, db, input as any),
        createOrganizationCheckoutSession,

        // ── Idempotency: look up an existing pending-checkout org by email ──
        // If this email already has a user + org in pending_checkout state, we skip
        // creating a second user/org and issue a fresh Stripe checkout URL instead.
        // This makes the endpoint safe to retry after a Stripe cancel without errors.
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
      },
      session?.user
        ? {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
          }
        : null,
    )

    if (result.status === 400 && result.body.errorCode === 'use_organization_creation_endpoint' && session?.user?.id) {
      console.warn('[POST /api/register] authenticated user hit unauthenticated endpoint', {
        userId: session.user.id,
        email: session.user.email,
        errorCode: result.body.errorCode,
      })
    }
    if (result.status === 409) {
      console.warn('[POST /api/register] conflict', {
        errorCode: result.body.errorCode,
        message: result.body.error,
      })
    }

    return NextResponse.json(result.body, { status: result.status })
  } catch (error: any) {
    console.error('[POST /api/register]', error)
    return NextResponse.json({ error: 'No se pudo completar el onboarding.' }, { status: 500 })
  }
}
