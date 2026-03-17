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
  organizationId?: string | null
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

/**
 * Represents an org that was created but whose Stripe checkout was never completed.
 * Used to make the registration endpoints idempotent — when a user cancels Stripe
 * and retries, we recover the existing org instead of attempting to create a duplicate.
 */
export type PendingCheckoutRecovery = {
  organizationId: string
  userId: string
  planKey: BillingProductKey
  interval: BillingPlanInterval | null
}

type RegisterDeps = {
  getBillingPlanByCheckoutKey: (key: BillingCheckoutKey | string | null | undefined) => BillingPlan | null | undefined
  isStripeConfigured: () => boolean
  runSelfServiceOnboarding: (input: SelfServiceOnboardingInput) => Promise<SelfServiceOnboardingResult>
  createOrganizationCheckoutSession: (input: CheckoutSessionInput) => Promise<{ url: string | null }>
  /**
   * Look up a pending-checkout org for an unauthenticated user by email.
   * Used to make POST /api/register idempotent after a Stripe cancel+retry.
   */
  findPendingCheckoutRecovery: (email: string) => Promise<PendingCheckoutRecovery | null>
}

type AuthenticatedDeps = RegisterDeps & {
  /**
   * Look up a pending-checkout org by its ID.
   * Used when an authenticated user retries after cancelling Stripe checkout.
   */
  findPendingCheckoutByOrgId: (orgId: string) => Promise<PendingCheckoutRecovery | null>
}

function pickFirstString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string') return value
  }
  return ''
}

/**
 * Shared helper: attempt to create a Stripe checkout session for a recovered
 * pending org. Returns a 200 response on both success and Stripe failure so the
 * caller always gets a usable response (with checkoutUrl=null + warning on error).
 */
async function recoverCheckoutSession(
  recovery: PendingCheckoutRecovery,
  userEmail: string,
  userName: string,
  deps: Pick<RegisterDeps, 'createOrganizationCheckoutSession'>,
  requiresLogin: boolean,
): Promise<ApiResult> {
  try {
    const checkout = await deps.createOrganizationCheckoutSession({
      organizationId: recovery.organizationId,
      userId: recovery.userId,
      userEmail,
      userName,
      planKey: recovery.planKey,
      interval: recovery.interval ?? undefined,
    })
    return {
      status: 200,
      body: {
        success: true,
        organizationId: recovery.organizationId,
        userId: recovery.userId,
        checkoutUrl: checkout.url,
        createdUser: false,
        requiresLogin,
        recovered: true,
      },
    }
  } catch {
    return {
      status: 200,
      body: {
        success: true,
        organizationId: recovery.organizationId,
        userId: recovery.userId,
        checkoutUrl: null,
        createdUser: false,
        requiresLogin,
        recovered: true,
        warning: requiresLogin
          ? 'Tu organizacion ya fue registrada, pero no se pudo abrir Stripe Checkout. Inicia sesion para reintentar el pago desde facturacion.'
          : 'Tu organizacion fue creada, pero no se pudo abrir Stripe Checkout. Ingresa a tu panel y reintenta el pago desde la seccion de facturacion.',
      },
    }
  }
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

  const email = pickFirstString(body.adminEmail, body.email).trim().toLowerCase()
  const userName = pickFirstString(body.adminName, body.fullName)

  // ── Idempotency: recover an existing pending-checkout org before creating a new one ──
  // This makes the endpoint safe to retry after Stripe cancel without producing
  // duplicate users or organizations in the database.
  if (email) {
    const recovery = await deps.findPendingCheckoutRecovery(email)
    if (recovery) {
      console.info('[handleRegisterOnboarding] recovering pending checkout', {
        email,
        organizationId: recovery.organizationId,
      })
      return recoverCheckoutSession(recovery, email, userName, deps, true)
    }
  }

  try {
    const onboarding = await deps.runSelfServiceOnboarding({
      fullName: userName,
      email,
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
        userEmail: email,
        userName,
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

  // ── Idempotency: recover an existing pending-checkout org for this user ──
  // Handles the Stripe cancel+retry flow for authenticated users:
  // register → Stripe → cancel → log in → return to /register → retry.
  // We detect their pending org and issue a fresh checkout URL instead of
  // attempting (and failing) to create a second organization.
  if (sessionUser.organizationId) {
    const recovery = await deps.findPendingCheckoutByOrgId(sessionUser.organizationId)
    if (recovery) {
      console.info('[handleAuthenticatedOrganizationCreation] recovering pending checkout', {
        userId: sessionUser.id,
        organizationId: recovery.organizationId,
      })
      return recoverCheckoutSession(
        recovery,
        sessionEmail,
        pickFirstString(body.adminName, sessionUser.name),
        deps,
        false,
      )
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
    if (error instanceof OnboardingConflictError && error.code === 'membership_exists') {
      // The user is already a member of their org but it's no longer pending_checkout
      // (e.g. a webhook arrived and activated it between the recovery check and now).
      // Log for observability and fall through to the 409 conflict response.
      console.warn('[handleAuthenticatedOrganizationCreation] membership conflict, org not in pending_checkout', {
        userId: sessionUser.id,
        email: sessionEmail,
      })
    }
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
