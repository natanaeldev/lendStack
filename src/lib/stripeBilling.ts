import type { Db } from 'mongodb'
import Stripe from 'stripe'
import {
  type BillingCheckoutInterval,
  type BillingPlanDefinition,
  type BillingPlanKey,
  type BillingRepository,
  createBillingPortal,
  createConnectOnboarding,
  createSubscriptionCheckout,
  processStripeWebhookEvent,
} from '@/lib/billingCore'
import { getStripeBillingPlanDefinitions } from '@/lib/billingPlans'
import { getDb } from '@/lib/mongodb'
import { assertStripeSecretEnv, getStripeSecretKey } from '@/lib/stripe/config'

export function getAppUrl() {
  const value = process.env.APP_URL || process.env.NEXTAUTH_URL
  if (!value) throw new Error('APP_URL is required for Stripe flows.')
  return value.replace(/\/+$/, '')
}

let stripeClient: Stripe | null = null

export function getStripeClient() {
  assertStripeSecretEnv()
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeSecretKey(), {
      apiVersion: '2025-02-24.acacia' as any,
    })
  }
  return stripeClient
}

export function getBillingPlans(env: NodeJS.ProcessEnv = process.env): BillingPlanDefinition[] {
  return getStripeBillingPlanDefinitions(env).map((plan) => ({
    ...plan,
    key: plan.key as BillingPlanKey,
    interval: plan.interval as BillingCheckoutInterval,
  }))
}

export function isStripeConfigured(env: NodeJS.ProcessEnv = process.env) {
  return !!getStripeSecretKey(env)
}

export function isStripeConnectConfigured(env: NodeJS.ProcessEnv = process.env) {
  return !!getStripeSecretKey(env) && !!env.STRIPE_CONNECT_RETURN_URL && !!env.STRIPE_CONNECT_REFRESH_URL
}

class MongoBillingRepository implements BillingRepository {
  constructor(private readonly db: Db) {}

  async ensureBillingIndexes() {
    await Promise.all([
      this.db.collection('organizations').createIndex({ stripeCustomerId: 1 }, { unique: true, sparse: true }),
      this.db.collection('organizations').createIndex({ stripeSubscriptionId: 1 }, { unique: true, sparse: true }),
      this.db.collection('organizations').createIndex({ stripeConnectedAccountId: 1 }, { unique: true, sparse: true }),
      this.db.collection('stripe_webhook_events').createIndex({ eventId: 1 }, { unique: true }),
    ])
  }

  async findOrganizationById(organizationId: string) {
    return this.db.collection('organizations').findOne({ _id: organizationId as any }) as any
  }

  async findOrganizationByStripeCustomerId(stripeCustomerId: string) {
    return this.db.collection('organizations').findOne({ stripeCustomerId }) as any
  }

  async findOrganizationByStripeSubscriptionId(stripeSubscriptionId: string) {
    return this.db.collection('organizations').findOne({ stripeSubscriptionId }) as any
  }

  async findOrganizationByStripeConnectedAccountId(stripeConnectedAccountId: string) {
    return this.db.collection('organizations').findOne({ stripeConnectedAccountId }) as any
  }

  async updateOrganization(organizationId: string, patch: Record<string, unknown>) {
    await this.db.collection('organizations').updateOne({ _id: organizationId as any }, { $set: patch })
  }

  async markWebhookEventProcessed(eventId: string, eventType: string, payload: Record<string, unknown>) {
    try {
      await this.db.collection('stripe_webhook_events').insertOne({
        eventId,
        eventType,
        payload,
        createdAt: new Date().toISOString(),
      })
      return true
    } catch (error: any) {
      if (error?.code === 11000) return false
      throw error
    }
  }
}

function getRepository(db: Db) {
  return new MongoBillingRepository(db)
}

function getStripeGateway() {
  const stripe = getStripeClient()
  return {
    async createCustomer(input: { email: string; name?: string | null; metadata: Record<string, string> }) {
      const customer = await stripe.customers.create({
        email: input.email,
        name: input.name ?? undefined,
        metadata: input.metadata,
      })
      return { id: customer.id }
    },
    async createCheckoutSession(input: {
      customerId: string
      priceId: string
      metadata: Record<string, string>
      successUrl: string
      cancelUrl: string
      idempotencyKey: string
    }) {
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          customer: input.customerId,
          line_items: [{ price: input.priceId, quantity: 1 }],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: input.metadata,
          subscription_data: {
            metadata: input.metadata,
          },
          allow_promotion_codes: true,
        },
        { idempotencyKey: input.idempotencyKey },
      )
      return { id: session.id, url: session.url }
    },
    async createBillingPortalSession(input: { customerId: string; returnUrl: string }) {
      const session = await stripe.billingPortal.sessions.create({
        customer: input.customerId,
        return_url: input.returnUrl,
      })
      return { url: session.url }
    },
    async createConnectedAccount(input: { email: string; metadata: Record<string, string> }) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: input.email,
        metadata: input.metadata,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'company',
      })
      return {
        id: account.id,
        detailsSubmitted: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      }
    },
    async createConnectAccountLink(input: { accountId: string; refreshUrl: string; returnUrl: string }) {
      const link = await stripe.accountLinks.create({
        account: input.accountId,
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        type: 'account_onboarding',
      })
      return { url: link.url }
    },
  }
}

export async function createOrganizationCheckoutSession(input: {
  organizationId: string
  userId?: string | null
  userEmail: string
  userName?: string | null
  planKey: BillingPlanKey
  interval?: BillingCheckoutInterval
}) {
  const db = await getDb()
  return createSubscriptionCheckout(getRepository(db), getStripeGateway(), getBillingPlans(), {
    organizationId: input.organizationId,
    planKey: input.planKey,
    interval: input.interval ?? 'month',
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    successUrl: `${getAppUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${getAppUrl()}/billing/cancel`,
  })
}

export async function createOrganizationBillingPortal(organizationId: string) {
  const db = await getDb()
  return createBillingPortal(getRepository(db), getStripeGateway(), organizationId, `${getAppUrl()}/app/billing`)
}

export async function createOrganizationConnectOnboarding(input: {
  organizationId: string
  contactEmail: string
}) {
  const db = await getDb()
  return createConnectOnboarding(getRepository(db), getStripeGateway(), {
    organizationId: input.organizationId,
    contactEmail: input.contactEmail,
    returnUrl: process.env.STRIPE_CONNECT_RETURN_URL || `${getAppUrl()}/app/billing?connect=return`,
    refreshUrl: process.env.STRIPE_CONNECT_REFRESH_URL || `${getAppUrl()}/app/billing?connect=refresh`,
  })
}

export async function handleStripeWebhook(event: Parameters<typeof processStripeWebhookEvent>[2]) {
  const db = await getDb()
  return processStripeWebhookEvent(getRepository(db), getBillingPlans(), event)
}
