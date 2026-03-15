import { NextRequest, NextResponse } from 'next/server'
import { createOrganizationCheckoutSession, getBillingPlans, isStripeConfigured } from '@/lib/stripeBilling'
import { getDb, getMongoClient, isDbConfigured } from '@/lib/mongodb'
import { OnboardingConflictError, OnboardingValidationError, runSelfServiceOnboarding } from '@/lib/selfServiceOnboarding'

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const plan = body.plan === 'pro' ? 'pro' : 'starter'
    const proMonthlyPlan = getBillingPlans().find((item) => item.key === 'pro' && item.interval === 'month')

    if (plan === 'pro' && (!isStripeConfigured() || !proMonthlyPlan?.active)) {
      return NextResponse.json({ error: 'El plan Pro no esta disponible en este entorno.' }, { status: 503 })
    }

    const client = await getMongoClient()
    const db = await getDb()

    const onboarding = await runSelfServiceOnboarding(client, db, {
      fullName: body.adminName ?? body.fullName ?? '',
      email: body.adminEmail ?? body.email ?? '',
      password: body.password ?? '',
      organizationName: body.orgName ?? body.organizationName ?? '',
      plan,
    })

    let checkoutUrl: string | null = null
    if (plan === 'pro') {
      try {
        const checkout = await createOrganizationCheckoutSession({
          organizationId: onboarding.organizationId,
          userId: onboarding.userId,
          userEmail: (body.adminEmail ?? body.email ?? '').trim().toLowerCase(),
          userName: body.adminName ?? body.fullName ?? '',
          planKey: 'pro',
          interval: 'month',
        })
        checkoutUrl = checkout.url
      } catch (checkoutError) {
        console.error('[POST /api/register] checkout bootstrap failed', checkoutError)
        return NextResponse.json({
          success: true,
          ...onboarding,
          checkoutUrl: null,
          warning: 'La organizacion fue creada, pero no se pudo abrir Stripe Checkout. Inicia sesion y reintenta el upgrade desde billing.',
        })
      }
    }

    return NextResponse.json({ success: true, ...onboarding, checkoutUrl })
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
