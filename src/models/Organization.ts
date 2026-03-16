export interface Organization {
  _id: string
  name: string
  ownerUserId?: string | null
  ownerEmail?: string | null
  featureOverrides?: {
    fullAccess?: boolean
    enabledFeatures?: string[]
  } | null
  plan: 'starter' | 'pro' | 'enterprise'
  billingPlan?: 'starter' | 'pro' | 'enterprise'
  billingStatus?:
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
  billingInterval?: 'month' | 'year' | null
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  stripeConnectedAccountId?: string | null
  stripeConnectStatus?: 'not_connected' | 'onboarding_required' | 'pending_verification' | 'active'
  currentPeriodEnd?: string | null
  trialEndsAt?: string | null
  isPaymentPastDue?: boolean
  createdAt: string
  updatedAt: string
}
