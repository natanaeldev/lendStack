import { NextRequest, NextResponse } from 'next/server'
import { resolveCheckoutPlan } from '@/lib/billingCore'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { createOrganizationCheckoutSession, getBillingPlans, isStripeConfigured } from '@/lib/stripeBilling'
import { getDb, isDbConfigured } from '@/lib/mongodb'

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for an organization.
 *
 * Body:
 *   - planKey:        'starter' | 'pro'   (required)
 *   - interval:       'month' | 'year'    (optional, defaults to 'month')
 *   - organizationId: string              (optional — pass when the org was just
 *                                          created and the JWT hasn't been refreshed yet;
 *                                          ownership is verified server-side)
 *
 * When organizationId is omitted, falls back to session.user.organizationId.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe no está configurado.' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const planKey = body.planKey === 'enterprise' ? 'enterprise' : body.planKey === 'pro' ? 'pro' : 'starter'
    const interval = body.interval === 'year' ? 'year' : 'month'

    // Resolve which org to bill. The caller may pass an explicit organizationId when
    // the org was just created and the JWT hasn't been updated yet.
    const requestedOrgId = body.organizationId as string | undefined
    let organizationId: string

    if (requestedOrgId) {
      // Verify the authenticated user actually owns the requested org.
      if (!isDbConfigured()) {
        return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })
      }
      const db = await getDb()
      const org = await db.collection('organizations').findOne({
        _id: requestedOrgId as any,
        ownerUserId: session.user.id,
      })
      if (!org) {
        return NextResponse.json(
          { error: 'No se encontró la organización o no tenés permisos para gestionarla.', errorCode: 'forbidden' },
          { status: 403 },
        )
      }
      organizationId = requestedOrgId
    } else {
      // Fall back to the org already linked to the session.
      organizationId = session.user.organizationId
      if (!organizationId) {
        return NextResponse.json(
          { error: 'No tenés ninguna organización activa en esta sesión.', errorCode: 'no_organization' },
          { status: 400 },
        )
      }
    }

    const plan = resolveCheckoutPlan(getBillingPlans(), planKey, interval)
    if (!plan || !plan.active || plan.isFree) {
      return NextResponse.json(
        { error: 'El plan seleccionado no está disponible para checkout.', errorCode: 'invalid_plan' },
        { status: 400 },
      )
    }

    const checkout = await createOrganizationCheckoutSession({
      organizationId,
      userId: session.user.id,
      userEmail: session.user.email ?? '',
      userName: session.user.name ?? '',
      planKey,
      interval,
    })

    return NextResponse.json({
      url: checkout.url,
      sessionId: checkout.id,
      checkoutKey: plan.checkoutKey,
    })
  } catch (error) {
    console.error('[POST /api/billing/checkout]', error)
    return NextResponse.json({ error: 'No se pudo iniciar el checkout.' }, { status: 500 })
  }
}
