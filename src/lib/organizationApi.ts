import type { BillingCheckoutKey, BillingPlanInterval, BillingProductKey } from './billingPlans'
import type { SelfServiceOnboardingInput, SelfServiceOnboardingResult } from './selfServiceOnboarding.ts'
import { OnboardingConflictError, OnboardingValidationError } from './selfServiceOnboarding.ts'
import { mapMongoDuplicateKeyToOnboardingConflict } from './onboardingConflicts.ts'

type BillingPlan = {
  active?: boolean
  stripePriceId?: string | null
  productKey: BillingProductKey
  interval: BillingPlanInterval
}

type SessionUser = {
  id: string
  email?: string | null
  name?: string | null
}

type ApiResult = {
  status: number
  body: Record<string, unknown>
}

type OrganizationRequestBody = {
  planKey?: BillingCheckoutKey | string | null
  adminName?: string | null
  fullName?: string | null
  adminEmail?: string | null
  email?: string | null
  password?: string | null
  orgName?: string | null
  organizationName?: string | null
}

type CheckoutSessionInput = {
  organizationId: string
  userId?: string | null
  userEmail: string
  userName?: string | null
  planKey: BillingProductKey
  interval?: BillingPlanInterval
}

type RegisterDeps = {
  getBillingPlanByCheckoutKey: (key: BillingCheckoutKey | string | null | undefined) => BillingPlan | null | undefined
  isStripeConfigured: () => boolean
  runSelfServiceOnboarding: (input: SelfServiceOnboardingInput) => Promise<SelfServiceOnboardingResult>
  createOrganizationCheckoutSession: (input: CheckoutSessionInput) => Promise<{ url: string | null }>
}

type AuthenticatedDeps = RegisterDeps

function pickFirstString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string') return value
  }
  return ''
}

export async function handleRegisterOnboarding(
  body: OrganizationRequestBody,
  deps: RegisterDeps,
  sessionUser?: SessionUser | null,
): Promise<ApiResult> {
  if (sessionUser?.id) {
    return {
      status: 400,
      body: {
        error: 'Los usuarios autenticados deben crear organizaciones desde el endpoint dedicado.',
        errorCode: 'use_organization_creation_endpoint',
      },
    }
  }

  const selectedPlan = deps.getBillingPlanByCheckoutKey(body.planKey)
  if (!selectedPlan || !selectedPlan.active || !selectedPlan.stripePriceId) {
    return {
      status: 400,
      body: {
        error: 'El plan seleccionado no esta configurado para este entorno.',
        errorCode: 'validation_error',
      },
    }
  }

  if (!deps.isStripeConfigured()) {
    return {
      status: 503,
      body: { error: 'Stripe no esta configurado.', errorCode: 'validation_error' },
    }
  }

  try {
    const onboarding = await deps.runSelfServiceOnboarding({
      fullName: pickFirstString(body.adminName, body.fullName),
      email: pickFirstString(body.adminEmail, body.email),
      password: pickFirstString(body.password),
      organizationName: pickFirstString(body.orgName, body.organizationName),
      plan: selectedPlan.productKey,
      billingInterval: selectedPlan.interval,
      requiresCheckout: true,
      authenticatedUserId: null,
      strictOrganizationConflicts: true,
    })

    try {
      const checkout = await deps.createOrganizationCheckoutSession({
        organizationId: onboarding.organizationId,
        userId: onboarding.userId,
        userEmail: pickFirstString(body.adminEmail, body.email).trim().toLowerCase(),
        userName: pickFirstString(body.adminName, body.fullName),
        planKey: selectedPlan.productKey,
        interval: selectedPlan.interval,
      })

      return {
        status: 200,
        body: {
          success: true,
          ...onboarding,
          checkoutUrl: checkout.url,
          createdUser: true,
          requiresLogin: true,
        },
      }
    } catch {
      return {
        status: 200,
        body: {
          success: true,
          ...onboarding,
          checkoutUrl: null,
          createdUser: true,
          requiresLogin: true,
          warning: 'La organizacion fue creada, pero no se pudo abrir Stripe Checkout. Inicia sesion y reintenta el checkout desde billing.',
        },
      }
    }
  } catch (error: any) {
    return mapOrganizationApiError(error, 'No se pudo completar el onboarding.')
  }
}

export async function handleAuthenticatedOrganizationCreation(
  body: OrganizationRequestBody,
  deps: AuthenticatedDeps,
  sessionUser: SessionUser,
): Promise<ApiResult> {
  const selectedPlan = deps.getBillingPlanByCheckoutKey(body.planKey)
  if (!selectedPlan || !selectedPlan.active || !selectedPlan.stripePriceId) {
    return {
      status: 400,
      body: {
        error: 'El plan seleccionado no esta configurado para este entorno.',
        errorCode: 'validation_error',
      },
    }
  }

  if (!deps.isStripeConfigured()) {
    return {
      status: 503,
      body: { error: 'Stripe no esta configurado.', errorCode: 'validation_error' },
    }
  }

  const requestedEmail = pickFirstString(body.adminEmail).trim().toLowerCase()
  const sessionEmail = String(sessionUser.email ?? '').trim().toLowerCase()
  if (!sessionEmail) {
    return {
      status: 400,
      body: { error: 'La sesion actual no tiene un email valido.', errorCode: 'validation_error' },
    }
  }
  if (requestedEmail && requestedEmail !== sessionEmail) {
    return {
      status: 409,
      body: {
        error: 'La sesion activa no coincide con el email que intentas usar como cuenta dueña.',
        errorCode: 'existing_user_session_mismatch',
      },
    }
  }

  try {
    const onboarding = await deps.runSelfServiceOnboarding({
      fullName: pickFirstString(body.adminName, sessionUser.name),
      email: sessionEmail,
      organizationName: pickFirstString(body.orgName, body.organizationName),
      plan: selectedPlan.productKey,
      billingInterval: selectedPlan.interval,
      requiresCheckout: true,
      authenticatedUserId: sessionUser.id,
      strictOrganizationConflicts: true,
    })

    try {
      const checkout = await deps.createOrganizationCheckoutSession({
        organizationId: onboarding.organizationId,
        userId: onboarding.userId,
        userEmail: sessionEmail,
        userName: pickFirstString(body.adminName, sessionUser.name),
        planKey: selectedPlan.productKey,
        interval: selectedPlan.interval,
      })

      return {
        status: 200,
        body: {
          success: true,
          ...onboarding,
          checkoutUrl: checkout.url,
          createdUser: false,
          requiresLogin: false,
        },
      }
    } catch {
      // Org was saved successfully but Stripe checkout could not be created.
      // Return success so the user reaches the dashboard and can retry from billing.
      return {
        status: 200,
        body: {
          success: true,
          ...onboarding,
          checkoutUrl: null,
          createdUser: false,
          requiresLogin: false,
          warning:
            'La organizacion fue creada, pero no se pudo abrir Stripe Checkout. Ingresa a tu panel y reintenta el pago desde la seccion de facturacion.',
        },
      }
    }
  } catch (error: any) {
    return mapOrganizationApiError(error, 'No se pudo crear la organizacion.')
  }
}

export function mapOrganizationApiError(error: any, fallbackMessage: string): ApiResult {
  if (error instanceof OnboardingValidationError) {
    return {
      status: 400,
      body: { error: error.message, errorCode: 'validation_error' },
    }
  }

  if (error instanceof OnboardingConflictError) {
    return {
      status: 409,
      body: { error: error.message, errorCode: error.code },
    }
  }

  const duplicateConflict = mapMongoDuplicateKeyToOnboardingConflict(error)
  if (duplicateConflict) {
    return {
      status: 409,
      body: { error: duplicateConflict.message, errorCode: duplicateConflict.code },
    }
  }

  return {
    status: 500,
    body: { error: fallbackMessage },
  }
}
