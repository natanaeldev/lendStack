import { NextRequest, NextResponse } from 'next/server'
import { getBillingPlanByCheckoutKey } from '@/lib/billingPlans'
import { getMongoClient, getDb, isDbConfigured } from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { createOrganizationCheckoutSession, isStripeConfigured } from '@/lib/stripeBilling'
import { OnboardingConflictError, OnboardingValidationError, runSelfServiceOnboarding } from '@/lib/selfServiceOnboarding'
import { mapMongoDuplicateKeyToOnboardingConflict } from '@/lib/onboardingConflicts'

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const selectedPlan = getBillingPlanByCheckoutKey(body.planKey)

    if (!selectedPlan || !selectedPlan.active || !selectedPlan.stripePriceId) {
      return NextResponse.json(
        { error: 'El plan seleccionado no esta configurado para este entorno.', errorCode: 'validation_error' },
        { status: 400 },
      )
    }

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: 'Stripe no esta configurado.', errorCode: 'validation_error' }, { status: 503 })
    }

    const requestedEmail = String(body.adminEmail ?? '').trim().toLowerCase()
    const sessionEmail = String(session.user.email ?? '').trim().toLowerCase()
    if (!sessionEmail) {
      return NextResponse.json(
        { error: 'La sesion actual no tiene un email valido.', errorCode: 'validation_error' },
        { status: 400 },
      )
    }
    if (requestedEmail && requestedEmail !== sessionEmail) {
      console.warn('[POST /api/organizations] session email mismatch', {
        sessionUserId: session.user.id,
        sessionEmail,
        requestedEmail,
      })
      return NextResponse.json(
        {
          error: 'La sesion activa no coincide con el email que intentas usar como cuenta dueña.',
          errorCode: 'existing_user_session_mismatch',
        },
        { status: 409 },
      )
    }

    const client = await getMongoClient()
    const db = await getDb()

    const onboarding = await runSelfServiceOnboarding(client, db, {
      fullName: body.adminName ?? session.user.name ?? '',
      email: sessionEmail,
      organizationName: body.orgName ?? body.organizationName ?? '',
      plan: selectedPlan.productKey,
      billingInterval: selectedPlan.interval,
      requiresCheckout: true,
      authenticatedUserId: session.user.id,
      strictOrganizationConflicts: true,
    })

    const checkout = await createOrganizationCheckoutSession({
      organizationId: onboarding.organizationId,
      userId: onboarding.userId,
      userEmail: sessionEmail,
      userName: body.adminName ?? session.user.name ?? '',
      planKey: selectedPlan.productKey,
      interval: selectedPlan.interval,
    })

    return NextResponse.json({
      success: true,
      ...onboarding,
      checkoutUrl: checkout.url,
      createdUser: false,
      requiresLogin: false,
    })
  } catch (error: any) {
    if (error instanceof OnboardingValidationError) {
      return NextResponse.json(
        { error: error.message, errorCode: 'validation_error' },
        { status: 400 },
      )
    }

    if (error instanceof OnboardingConflictError) {
      console.warn('[POST /api/organizations] onboarding conflict', {
        userId: session.user.id,
        email: session.user.email,
        errorCode: error.code,
        message: error.message,
      })
      return NextResponse.json(
        { error: error.message, errorCode: error.code },
        { status: 409 },
      )
    }

    const duplicateConflict = mapMongoDuplicateKeyToOnboardingConflict(error)
    if (duplicateConflict) {
      console.warn('[POST /api/organizations] duplicate key conflict', {
        userId: session.user.id,
        email: session.user.email,
        errorCode: duplicateConflict.code,
        message: duplicateConflict.message,
        keyPattern: error?.keyPattern,
        keyValue: error?.keyValue,
      })
      return NextResponse.json(
        { error: duplicateConflict.message, errorCode: duplicateConflict.code },
        { status: 409 },
      )
    }

    console.error('[POST /api/organizations]', error)
    return NextResponse.json({ error: 'No se pudo crear la organizacion.' }, { status: 500 })
  }
}
