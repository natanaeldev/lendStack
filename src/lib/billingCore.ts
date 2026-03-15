export type BillingPlanKey = 'starter' | 'pro' | 'enterprise'
export type BillingInterval = 'month' | 'year' | null
export type BillingStatus =
  | 'not_started'
  | 'pending_checkout'
  | 'pending_activation'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'

export type ConnectStatus = 'not_connected' | 'onboarding_required' | 'pending_verification' | 'active'

export interface BillingPlanDefinition {
  key: BillingPlanKey
  name: string
  interval: BillingInterval
  stripePriceId: string | null
  active: boolean
  amountLabel: string
  isFree: boolean
}

export interface BillingOrganization {
  _id: string
  name: string
  plan?: BillingPlanKey
  billingPlan?: BillingPlanKey
  billingStatus?: BillingStatus
  billingInterval?: BillingInterval
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  stripeConnectedAccountId?: string | null
  stripeCheckoutSessionId?: string | null
  currentPeriodEnd?: string | null
  trialEndsAt?: string | null
  isPaymentPastDue?: boolean
  stripeConnectStatus?: ConnectStatus
  stripeChargesEnabled?: boolean
  stripePayoutsEnabled?: boolean
  updatedAt?: string
}

export interface BillingAccess {
  allowWorkspace: boolean
  allowPremiumFeatures: boolean
  downgradeToStarter: boolean
  statusLabel: string
}

export interface CheckoutSessionInput {
  organizationId: string
  planKey: BillingPlanKey
  userId?: string | null
  userEmail: string
  userName?: string | null
  successUrl: string
  cancelUrl: string
}

export interface CheckoutSessionResult {
  id: string
  url: string | null
  customerId: string
}

export interface BillingPortalResult {
  url: string
}

export interface ConnectOnboardingResult {
  accountId: string
  url: string
}

export interface BillingRepository {
  ensureBillingIndexes(): Promise<void>
  findOrganizationById(organizationId: string): Promise<BillingOrganization | null>
  findOrganizationByStripeCustomerId(stripeCustomerId: string): Promise<BillingOrganization | null>
  findOrganizationByStripeSubscriptionId(stripeSubscriptionId: string): Promise<BillingOrganization | null>
  findOrganizationByStripeConnectedAccountId(stripeConnectedAccountId: string): Promise<BillingOrganization | null>
  updateOrganization(organizationId: string, patch: Record<string, unknown>): Promise<void>
  markWebhookEventProcessed(eventId: string, eventType: string, payload: Record<string, unknown>): Promise<boolean>
}

export interface StripeCheckoutGateway {
  createCustomer(input: { email: string; name?: string | null; metadata: Record<string, string> }): Promise<{ id: string }>
  createCheckoutSession(input: {
    customerId: string
    priceId: string
    metadata: Record<string, string>
    successUrl: string
    cancelUrl: string
    idempotencyKey: string
  }): Promise<{ id: string; url: string | null }>
  createBillingPortalSession(input: {
    customerId: string
    returnUrl: string
  }): Promise<{ url: string }>
  createConnectedAccount(input: {
    email: string
    metadata: Record<string, string>
  }): Promise<{
    id: string
    detailsSubmitted?: boolean
    chargesEnabled?: boolean
    payoutsEnabled?: boolean
  }>
  createConnectAccountLink(input: {
    accountId: string
    refreshUrl: string
    returnUrl: string
  }): Promise<{ url: string }>
}

export interface StripeEventEnvelope {
  id: string
  type: string
  created?: number
  data: {
    object: any
  }
}

function toIsoFromUnix(timestamp: number | null | undefined) {
  if (!timestamp) return null
  return new Date(timestamp * 1000).toISOString()
}

export function normalizeBillingStatus(status: string | null | undefined): BillingStatus {
  switch (String(status ?? '').toLowerCase()) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    case 'unpaid':
      return 'unpaid'
    case 'incomplete':
      return 'incomplete'
    case 'incomplete_expired':
      return 'incomplete_expired'
    case 'pending_checkout':
      return 'pending_checkout'
    case 'pending_activation':
      return 'pending_activation'
    default:
      return 'not_started'
  }
}

export function getBillingAccess(status: BillingStatus): BillingAccess {
  switch (status) {
    case 'trialing':
      return { allowWorkspace: true, allowPremiumFeatures: true, downgradeToStarter: false, statusLabel: 'Prueba' }
    case 'active':
      return { allowWorkspace: true, allowPremiumFeatures: true, downgradeToStarter: false, statusLabel: 'Activa' }
    case 'past_due':
      return { allowWorkspace: true, allowPremiumFeatures: true, downgradeToStarter: false, statusLabel: 'Pago pendiente' }
    case 'pending_checkout':
      return { allowWorkspace: true, allowPremiumFeatures: false, downgradeToStarter: false, statusLabel: 'Checkout pendiente' }
    case 'pending_activation':
      return { allowWorkspace: true, allowPremiumFeatures: false, downgradeToStarter: false, statusLabel: 'Activación pendiente' }
    case 'canceled':
      return { allowWorkspace: true, allowPremiumFeatures: false, downgradeToStarter: true, statusLabel: 'Cancelada' }
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
      return { allowWorkspace: true, allowPremiumFeatures: false, downgradeToStarter: true, statusLabel: 'Cobro fallido' }
    default:
      return { allowWorkspace: true, allowPremiumFeatures: false, downgradeToStarter: false, statusLabel: 'Sin suscripción' }
  }
}

export function canManageOrganizationBilling(role: string | null | undefined) {
  return role === 'master' || role === 'admin'
}

export function deriveEffectivePlan(planKey: BillingPlanKey | null | undefined, billingStatus: BillingStatus): BillingPlanKey {
  const normalizedPlan = planKey ?? 'starter'
  const access = getBillingAccess(billingStatus)
  return access.downgradeToStarter ? 'starter' : normalizedPlan
}

export function resolvePlanByPriceId(plans: BillingPlanDefinition[], stripePriceId: string | null | undefined): BillingPlanDefinition | null {
  if (!stripePriceId) return null
  return plans.find((plan) => plan.stripePriceId === stripePriceId) ?? null
}

export function deriveConnectStatus(input: {
  accountId?: string | null
  detailsSubmitted?: boolean
  chargesEnabled?: boolean
  payoutsEnabled?: boolean
}): ConnectStatus {
  if (!input.accountId) return 'not_connected'
  if (input.chargesEnabled && input.payoutsEnabled) return 'active'
  if (input.detailsSubmitted) return 'pending_verification'
  return 'onboarding_required'
}

export function deriveSubscriptionPatch(
  subscription: any,
  plans: BillingPlanDefinition[],
  fallbackPlan?: BillingPlanKey | null,
): Record<string, unknown> {
  const billingStatus = normalizeBillingStatus(subscription?.status)
  const priceId = subscription?.items?.data?.[0]?.price?.id ?? null
  const matchedPlan = resolvePlanByPriceId(plans, priceId)
  const billingPlan = matchedPlan?.key ?? fallbackPlan ?? 'starter'
  const billingInterval = matchedPlan?.interval ?? null
  const effectivePlan = deriveEffectivePlan(billingPlan, billingStatus)

  return {
    stripeCustomerId: subscription?.customer ? String(subscription.customer) : null,
    stripeSubscriptionId: subscription?.id ? String(subscription.id) : null,
    billingStatus,
    billingPlan,
    billingInterval,
    plan: effectivePlan,
    currentPeriodEnd: toIsoFromUnix(subscription?.current_period_end),
    trialEndsAt: toIsoFromUnix(subscription?.trial_end),
    isPaymentPastDue: billingStatus === 'past_due',
    stripeCheckoutSessionId: null,
    updatedAt: new Date().toISOString(),
  }
}

export async function createSubscriptionCheckout(
  repository: BillingRepository,
  gateway: StripeCheckoutGateway,
  plans: BillingPlanDefinition[],
  input: CheckoutSessionInput,
) {
  await repository.ensureBillingIndexes()
  const organization = await repository.findOrganizationById(input.organizationId)
  if (!organization) throw new Error('Organization not found.')

  const plan = plans.find((item) => item.key === input.planKey)
  if (!plan || !plan.active || plan.isFree || !plan.stripePriceId) {
    throw new Error('Selected billing plan is not available for checkout.')
  }

  const customerId =
    organization.stripeCustomerId ||
    (
      await gateway.createCustomer({
        email: input.userEmail,
        name: input.userName ?? organization.name,
        metadata: {
          organizationId: input.organizationId,
          userId: input.userId ?? '',
          planKey: input.planKey,
        },
      })
    ).id

  const session = await gateway.createCheckoutSession({
    customerId,
    priceId: plan.stripePriceId,
    metadata: {
      organizationId: input.organizationId,
      userId: input.userId ?? '',
      planKey: input.planKey,
      interval: plan.interval ?? '',
    },
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    idempotencyKey: `checkout:${input.organizationId}:${input.planKey}`,
  })

  await repository.updateOrganization(input.organizationId, {
    stripeCustomerId: customerId,
    billingPlan: input.planKey,
    billingInterval: plan.interval,
    billingStatus: 'pending_checkout',
    stripeCheckoutSessionId: session.id,
    updatedAt: new Date().toISOString(),
  })

  return {
    id: session.id,
    url: session.url,
    customerId,
  } satisfies CheckoutSessionResult
}

export async function createBillingPortal(
  repository: BillingRepository,
  gateway: StripeCheckoutGateway,
  organizationId: string,
  returnUrl: string,
) {
  const organization = await repository.findOrganizationById(organizationId)
  if (!organization?.stripeCustomerId) {
    throw new Error('Organization does not have an active Stripe customer.')
  }

  return gateway.createBillingPortalSession({
    customerId: organization.stripeCustomerId,
    returnUrl,
  }) satisfies Promise<BillingPortalResult>
}

export async function createConnectOnboarding(
  repository: BillingRepository,
  gateway: StripeCheckoutGateway,
  input: {
    organizationId: string
    contactEmail: string
    returnUrl: string
    refreshUrl: string
  },
) {
  const organization = await repository.findOrganizationById(input.organizationId)
  if (!organization) throw new Error('Organization not found.')

  let accountId = organization.stripeConnectedAccountId ?? null
  let chargesEnabled = organization.stripeChargesEnabled
  let payoutsEnabled = organization.stripePayoutsEnabled
  let detailsSubmitted = organization.stripeConnectStatus === 'pending_verification' || organization.stripeConnectStatus === 'active'

  if (!accountId) {
    const account = await gateway.createConnectedAccount({
      email: input.contactEmail,
      metadata: {
        organizationId: input.organizationId,
      },
    })
    accountId = account.id
    chargesEnabled = !!account.chargesEnabled
    payoutsEnabled = !!account.payoutsEnabled
    detailsSubmitted = !!account.detailsSubmitted
  }

  const accountLink = await gateway.createConnectAccountLink({
    accountId,
    refreshUrl: input.refreshUrl,
    returnUrl: input.returnUrl,
  })

  await repository.updateOrganization(input.organizationId, {
    stripeConnectedAccountId: accountId,
    stripeConnectStatus: deriveConnectStatus({
      accountId,
      detailsSubmitted,
      chargesEnabled,
      payoutsEnabled,
    }),
    stripeChargesEnabled: !!chargesEnabled,
    stripePayoutsEnabled: !!payoutsEnabled,
    updatedAt: new Date().toISOString(),
  })

  return {
    accountId,
    url: accountLink.url,
  } satisfies ConnectOnboardingResult
}

function resolveOrganizationForStripeObject(
  repository: BillingRepository,
  object: any,
  metadataOrgId?: string | null,
) {
  if (metadataOrgId) return repository.findOrganizationById(metadataOrgId)
  if (object?.subscription) return repository.findOrganizationByStripeSubscriptionId(String(object.subscription))
  if (object?.id && object?.object === 'subscription') return repository.findOrganizationByStripeSubscriptionId(String(object.id))
  if (object?.customer) return repository.findOrganizationByStripeCustomerId(String(object.customer))
  if (object?.account) return repository.findOrganizationByStripeConnectedAccountId(String(object.account))
  if (object?.id && object?.object === 'account') return repository.findOrganizationByStripeConnectedAccountId(String(object.id))
  return Promise.resolve(null)
}

export async function processStripeWebhookEvent(
  repository: BillingRepository,
  plans: BillingPlanDefinition[],
  event: StripeEventEnvelope,
) {
  await repository.ensureBillingIndexes()
  const accepted = await repository.markWebhookEventProcessed(event.id, event.type, {
    created: event.created ?? null,
  })
  if (!accepted) return { duplicate: true }

  const object = event.data.object

  if (event.type === 'checkout.session.completed') {
    const organizationId = object?.metadata?.organizationId ?? object?.metadata?.orgId ?? null
    if (organizationId) {
      const requestedPlan = (object?.metadata?.planKey as BillingPlanKey | undefined) ?? 'pro'
      await repository.updateOrganization(String(organizationId), {
        stripeCustomerId: object?.customer ? String(object.customer) : null,
        stripeSubscriptionId: object?.subscription ? String(object.subscription) : null,
        stripeCheckoutSessionId: object?.id ? String(object.id) : null,
        billingPlan: requestedPlan,
        billingStatus: 'pending_activation',
        billingInterval: object?.metadata?.interval || 'month',
        updatedAt: new Date().toISOString(),
      })
    }
    return { duplicate: false }
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const organization = await resolveOrganizationForStripeObject(
      repository,
      object,
      object?.metadata?.organizationId ?? object?.metadata?.orgId ?? null,
    )
    if (organization) {
      const patch = deriveSubscriptionPatch(object, plans, organization.billingPlan ?? organization.plan ?? 'starter')
      await repository.updateOrganization(organization._id, patch)
    }
    return { duplicate: false }
  }

  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    const organization = await resolveOrganizationForStripeObject(repository, object, null)
    if (organization) {
      const status: BillingStatus = event.type === 'invoice.paid' ? 'active' : 'past_due'
      await repository.updateOrganization(organization._id, {
        billingStatus: status,
        isPaymentPastDue: status === 'past_due',
        plan: deriveEffectivePlan(organization.billingPlan ?? organization.plan ?? 'starter', status),
        updatedAt: new Date().toISOString(),
      })
    }
    return { duplicate: false }
  }

  if (event.type === 'account.updated') {
    const organization = await resolveOrganizationForStripeObject(repository, object, object?.metadata?.organizationId ?? null)
    if (organization) {
      await repository.updateOrganization(organization._id, {
        stripeConnectedAccountId: String(object.id),
        stripeConnectStatus: deriveConnectStatus({
          accountId: String(object.id),
          detailsSubmitted: !!object.details_submitted,
          chargesEnabled: !!object.charges_enabled,
          payoutsEnabled: !!object.payouts_enabled,
        }),
        stripeChargesEnabled: !!object.charges_enabled,
        stripePayoutsEnabled: !!object.payouts_enabled,
        updatedAt: new Date().toISOString(),
      })
    }
    return { duplicate: false }
  }

  return { duplicate: false }
}
