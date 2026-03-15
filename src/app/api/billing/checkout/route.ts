import { NextRequest, NextResponse } from 'next/server'
import { createOrganizationCheckoutSession, getBillingPlans, isStripeConfigured } from '@/lib/stripeBilling'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe no está configurado.' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const planKey = body.planKey === 'enterprise' ? 'enterprise' : body.planKey === 'pro' ? 'pro' : 'starter'
    const plan = getBillingPlans().find((item) => item.key === planKey)

    if (!plan || plan.isFree || !plan.active) {
      return NextResponse.json({ error: 'El plan seleccionado no está disponible para checkout.' }, { status: 400 })
    }

    const checkout = await createOrganizationCheckoutSession({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      userEmail: session.user.email ?? '',
      userName: session.user.name ?? '',
      planKey,
    })

    return NextResponse.json({ url: checkout.url, sessionId: checkout.id })
  } catch (error: any) {
    console.error('[POST /api/billing/checkout]', error)
    return NextResponse.json({ error: 'No se pudo iniciar el checkout.' }, { status: 500 })
  }
}
