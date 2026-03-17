import { NextRequest, NextResponse } from 'next/server'
import { getBillingPlanByCheckoutKey } from '@/lib/billingPlans'
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
      },
      {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
    )

    // When the user already has an org that is still pending Stripe checkout
    // (e.g. they cancelled Stripe and are retrying), create a new checkout session
    // for the existing pending org instead of failing with a conflict error.
    // NOTE: only attempt the retry for `membership_exists` — the user is the owner of
    // that org.  `organization_exists` means a *different* user's org has the same
    // name; retrying with the caller's org would be wrong.
    if (result.status === 409 && result.body.errorCode === 'membership_exists') {
      const orgId = session.user.organizationId
      if (orgId && isStripeConfigured()) {
        const org = await db.collection('organizations').findOne({ _id: orgId as any })
        if (org && org.billingStatus === 'pending_checkout') {
          const selectedPlan = getBillingPlanByCheckoutKey(body.planKey)
          if (selectedPlan?.active && selectedPlan?.stripePriceId) {
            try {
              const checkout = await createOrganizationCheckoutSession({
                organizationId: String(org._id),
                userId: session.user.id,
                userEmail: String(session.user.email ?? '').trim().toLowerCase(),
                userName: session.user.name,
                planKey: selectedPlan.productKey as any,
                interval: selectedPlan.interval,
              })
              return NextResponse.json({
                success: true,
                organizationId: org._id,
                checkoutUrl: checkout.url,
                createdUser: false,
                requiresLogin: false,
              })
            } catch (checkoutError: any) {
              console.error('[POST /api/organizations] retry checkout failed', checkoutError)
              // Return an explicit checkout-failure error instead of falling through
              // to the confusing "Ya perteneces a esa organizacion" 409 message.
              return NextResponse.json(
                {
                  error:
                    'Tu organizacion fue registrada, pero no se pudo abrir Stripe Checkout. Ingresa a tu panel y reintenta el pago desde la seccion de facturacion.',
                  errorCode: 'checkout_failed',
                },
                { status: 502 },
              )
            }
          }
        }
      }

      console.warn('[POST /api/organizations] membership conflict without pending checkout', {
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
