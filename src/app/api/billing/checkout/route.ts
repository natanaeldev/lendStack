import { NextRequest, NextResponse } from 'next/server'
import { resolveCheckoutPlan } from '@/lib/billingCore'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { createOrganizationCheckoutSession, getBillingPlans, isStripeConfigured } from '@/lib/stripeBilling'

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe no esta configurado.' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const planKey = body.planKey === 'enterprise' ? 'enterprise' : body.planKey === 'pro' ? 'pro' : 'starter'
    const interval = body.interval === 'year' ? 'year' : 'month'
    const plan = resolveCheckoutPlan(getBillingPlans(), planKey, interval)

    if (!plan || !plan.active || plan.isFree) {
      return NextResponse.json({ error: 'El plan seleccionado no esta disponible para checkout.' }, { status: 400 })
    }

    const checkout = await createOrganizationCheckoutSession({
      organizationId: session.user.organizationId,
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
