import assert from 'node:assert/strict'
import {
  canManageOrganizationBilling,
  createBillingPortal,
  createConnectOnboarding,
  createSubscriptionCheckout,
  deriveConnectStatus,
  deriveEffectivePlan,
  deriveSubscriptionPatch,
  getBillingAccess,
  processStripeWebhookEvent,
} from '../src/lib/billingCore.ts'

async function run(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

const plans = [
  { key: 'starter', name: 'Starter', interval: null, stripePriceId: null, active: true, amountLabel: 'Gratis', isFree: true },
  { key: 'pro', name: 'Pro', interval: 'month', stripePriceId: 'price_pro_monthly', active: true, amountLabel: 'USD 29 / mes', isFree: false },
  { key: 'enterprise', name: 'Enterprise', interval: 'month', stripePriceId: 'price_enterprise_monthly', active: true, amountLabel: 'Personalizado', isFree: false },
]

class InMemoryBillingRepository {
  constructor(orgs = []) {
    this.orgs = orgs
    this.events = new Set()
  }

  async ensureBillingIndexes() {}

  async findOrganizationById(id) {
    return this.orgs.find((org) => org._id === id) ?? null
  }

  async findOrganizationByStripeCustomerId(id) {
    return this.orgs.find((org) => org.stripeCustomerId === id) ?? null
  }

  async findOrganizationByStripeSubscriptionId(id) {
    return this.orgs.find((org) => org.stripeSubscriptionId === id) ?? null
  }

  async findOrganizationByStripeConnectedAccountId(id) {
    return this.orgs.find((org) => org.stripeConnectedAccountId === id) ?? null
  }

  async updateOrganization(id, patch) {
    const org = await this.findOrganizationById(id)
    if (!org) throw new Error('org not found')
    Object.assign(org, patch)
  }

  async markWebhookEventProcessed(eventId) {
    if (this.events.has(eventId)) return false
    this.events.add(eventId)
    return true
  }
}

class FakeStripeGateway {
  constructor() {
    this.createdCustomers = []
    this.createdCheckouts = []
    this.portalRequests = []
    this.connectedAccounts = []
  }

  async createCustomer(input) {
    this.createdCustomers.push(input)
    return { id: `cus_${this.createdCustomers.length}` }
  }

  async createCheckoutSession(input) {
    this.createdCheckouts.push(input)
    return { id: `cs_${this.createdCheckouts.length}`, url: `https://checkout.test/${this.createdCheckouts.length}` }
  }

  async createBillingPortalSession(input) {
    this.portalRequests.push(input)
    return { url: 'https://portal.test/session' }
  }

  async createConnectedAccount(input) {
    this.connectedAccounts.push(input)
    return { id: `acct_${this.connectedAccounts.length}`, detailsSubmitted: false, chargesEnabled: false, payoutsEnabled: false }
  }

  async createConnectAccountLink(input) {
    return { url: `https://connect.test/${input.accountId}` }
  }
}

await run('checkout session creation associates customer and organization', async () => {
  const repository = new InMemoryBillingRepository([{ _id: 'org_1', name: 'Org Uno', plan: 'starter', billingPlan: 'starter', billingStatus: 'active' }])
  const gateway = new FakeStripeGateway()

  const result = await createSubscriptionCheckout(repository, gateway, plans, {
    organizationId: 'org_1',
    planKey: 'pro',
    userId: 'user_1',
    userEmail: 'owner@example.com',
    userName: 'Owner',
    successUrl: 'https://app.test/billing/success',
    cancelUrl: 'https://app.test/billing/cancel',
  })

  assert.equal(result.customerId, 'cus_1')
  assert.equal(repository.orgs[0].stripeCustomerId, 'cus_1')
  assert.equal(repository.orgs[0].billingStatus, 'pending_checkout')
  assert.equal(repository.orgs[0].billingPlan, 'pro')
  assert.equal(gateway.createdCheckouts[0].priceId, 'price_pro_monthly')
})

await run('subscription patch maps active status and totals cleanly', () => {
  const patch = deriveSubscriptionPatch({
    id: 'sub_1',
    customer: 'cus_1',
    status: 'active',
    current_period_end: 1760000000,
    trial_end: null,
    items: { data: [{ price: { id: 'price_pro_monthly' } }] },
  }, plans, 'starter')

  assert.equal(patch.billingStatus, 'active')
  assert.equal(patch.billingPlan, 'pro')
  assert.equal(patch.plan, 'pro')
  assert.equal(patch.isPaymentPastDue, false)
})

await run('webhook sync handles checkout and subscription lifecycle transitions', async () => {
  const repository = new InMemoryBillingRepository([{
    _id: 'org_1',
    name: 'Org Uno',
    plan: 'starter',
    billingPlan: 'starter',
    billingStatus: 'active',
  }])

  await processStripeWebhookEvent(repository, plans, {
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_1', customer: 'cus_1', subscription: 'sub_1', metadata: { organizationId: 'org_1', planKey: 'pro', interval: 'month' } } },
  })
  assert.equal(repository.orgs[0].billingStatus, 'pending_activation')
  assert.equal(repository.orgs[0].stripeSubscriptionId, 'sub_1')

  await processStripeWebhookEvent(repository, plans, {
    id: 'evt_2',
    type: 'customer.subscription.created',
    data: { object: { id: 'sub_1', customer: 'cus_1', status: 'trialing', current_period_end: 1760000000, trial_end: 1750000000, items: { data: [{ price: { id: 'price_pro_monthly' } }] } } },
  })
  assert.equal(repository.orgs[0].billingStatus, 'trialing')
  assert.equal(repository.orgs[0].plan, 'pro')

  await processStripeWebhookEvent(repository, plans, {
    id: 'evt_3',
    type: 'invoice.payment_failed',
    data: { object: { customer: 'cus_1', subscription: 'sub_1' } },
  })
  assert.equal(repository.orgs[0].billingStatus, 'past_due')
  assert.equal(repository.orgs[0].isPaymentPastDue, true)

  await processStripeWebhookEvent(repository, plans, {
    id: 'evt_4',
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_1', customer: 'cus_1', status: 'canceled', items: { data: [{ price: { id: 'price_pro_monthly' } }] } } },
  })
  assert.equal(repository.orgs[0].billingStatus, 'canceled')
  assert.equal(repository.orgs[0].plan, 'starter')
})

await run('duplicate webhook event is idempotent', async () => {
  const repository = new InMemoryBillingRepository([{ _id: 'org_1', name: 'Org Uno', plan: 'starter', billingPlan: 'starter', billingStatus: 'active' }])
  const event = {
    id: 'evt_duplicate',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_1', customer: 'cus_1', subscription: 'sub_1', metadata: { organizationId: 'org_1', planKey: 'pro', interval: 'month' } } },
  }

  const first = await processStripeWebhookEvent(repository, plans, event)
  const second = await processStripeWebhookEvent(repository, plans, event)
  assert.equal(first.duplicate, false)
  assert.equal(second.duplicate, true)
})

await run('billing portal requires stripe customer on the organization', async () => {
  const repository = new InMemoryBillingRepository([{ _id: 'org_1', name: 'Org Uno', plan: 'pro', billingPlan: 'pro', billingStatus: 'active', stripeCustomerId: 'cus_1' }])
  const gateway = new FakeStripeGateway()

  const result = await createBillingPortal(repository, gateway, 'org_1', 'https://app.test/app')
  assert.equal(result.url, 'https://portal.test/session')
  assert.equal(gateway.portalRequests[0].customerId, 'cus_1')
})

await run('connect onboarding creates and stores connected account', async () => {
  const repository = new InMemoryBillingRepository([{ _id: 'org_1', name: 'Org Uno', plan: 'starter', billingPlan: 'starter', billingStatus: 'active' }])
  const gateway = new FakeStripeGateway()

  const result = await createConnectOnboarding(repository, gateway, {
    organizationId: 'org_1',
    contactEmail: 'owner@example.com',
    returnUrl: 'https://app.test/return',
    refreshUrl: 'https://app.test/refresh',
  })

  assert.equal(result.accountId, 'acct_1')
  assert.equal(repository.orgs[0].stripeConnectedAccountId, 'acct_1')
  assert.equal(repository.orgs[0].stripeConnectStatus, 'onboarding_required')
})

await run('access gating downgrades unpaid subscriptions to starter entitlements', () => {
  assert.equal(deriveEffectivePlan('pro', 'active'), 'pro')
  assert.equal(deriveEffectivePlan('pro', 'unpaid'), 'starter')
  assert.equal(getBillingAccess('past_due').allowPremiumFeatures, true)
  assert.equal(getBillingAccess('unpaid').allowPremiumFeatures, false)
  assert.equal(deriveConnectStatus({ accountId: 'acct_1', chargesEnabled: true, payoutsEnabled: true }), 'active')
  assert.equal(canManageOrganizationBilling('master'), true)
  assert.equal(canManageOrganizationBilling('admin'), true)
  assert.equal(canManageOrganizationBilling('user'), false)
})
