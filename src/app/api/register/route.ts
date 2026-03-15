import { NextRequest, NextResponse } from 'next/server'
import { getBillingPlanByCheckoutKey } from '@/lib/billingPlans'
import { createOrganizationCheckoutSession, isStripeConfigured } from '@/lib/stripeBilling'
import { getDb, getMongoClient, isDbConfigured } from '@/lib/mongodb'
import { OnboardingConflictError, OnboardingValidationError, runSelfServiceOnboarding } from '@/lib/selfServiceOnboarding'

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const selectedPlan = getBillingPlanByCheckoutKey(body.planKey)

    if (!selectedPlan || !selectedPlan.active || !selectedPlan.stripePriceId) {
      return NextResponse.json({ error: 'El plan seleccionado no esta configurado para este entorno.' }, { status: 400 })
    }

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: 'Stripe no esta configurado.' }, { status: 503 })
    }

    const client = await getMongoClient()
    const db = await getDb()

    const onboarding = await runSelfServiceOnboarding(client, db, {
      fullName: body.adminName ?? body.fullName ?? '',
      email: body.adminEmail ?? body.email ?? '',
      password: body.password ?? '',
      organizationName: body.orgName ?? body.organizationName ?? '',
      plan: selectedPlan.productKey,
      billingInterval: selectedPlan.interval,
      requiresCheckout: true,
    })

    try {
      const checkout = await createOrganizationCheckoutSession({
        organizationId: onboarding.organizationId,
        userId: onboarding.userId,
        userEmail: (body.adminEmail ?? body.email ?? '').trim().toLowerCase(),
        userName: body.adminName ?? body.fullName ?? '',
        planKey: selectedPlan.productKey,
        interval: selectedPlan.interval,
      })

      return NextResponse.json({ success: true, ...onboarding, checkoutUrl: checkout.url })
    } catch (checkoutError) {
      console.error('[POST /api/register] checkout bootstrap failed', checkoutError)
      return NextResponse.json({
        success: true,
        ...onboarding,
        checkoutUrl: null,
        warning: 'La organizacion fue creada, pero no se pudo abrir Stripe Checkout. Inicia sesion y reintenta el checkout desde billing.',
      })
    }
  } catch (error: any) {
    if (error instanceof OnboardingValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof OnboardingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error?.code === 11000) {
      return NextResponse.json({ error: 'La cuenta ya fue creada. Inicia sesion.' }, { status: 409 })
    }
    console.error('[POST /api/register]', error)
    return NextResponse.json({ error: 'No se pudo completar el onboarding.' }, { status: 500 })
  }
}
