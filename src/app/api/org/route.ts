import { NextResponse } from 'next/server'
import { canManageOrganizationBilling, getBillingAccess } from '@/lib/billingCore'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { getDb, isDbConfigured } from '@/lib/mongodb'
import { getBillingPlans, isStripeConfigured, isStripeConnectConfigured } from '@/lib/stripeBilling'

export async function GET() {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 })
  }

  try {
    const db = await getDb()
    const org = await db.collection('organizations').findOne({
      _id: session.user.organizationId as any,
    })

    const billingStatus = (org?.billingStatus as string | undefined) ?? 'active'
    const access = getBillingAccess(billingStatus as any)
    const plan = (org?.plan as string | undefined) ?? 'starter'
    const billingPlan = (org?.billingPlan as string | undefined) ?? plan
    const billingInterval = (org?.billingInterval as string | undefined) ?? null
    const plans = getBillingPlans()

    const clientCount = await db.collection('clients').countDocuments({
      organizationId: session.user.organizationId,
    })

    const limits = {
      starter: { maxClients: 50 },
      pro: { maxClients: Infinity },
      enterprise: { maxClients: Infinity },
    }
    const maxClients = (limits[plan as keyof typeof limits] ?? limits.starter).maxClients

    return NextResponse.json({
      orgId: String(org?._id ?? session.user.organizationId),
      orgName: (org?.name as string | undefined) ?? '',
      plan,
      billingPlan,
      billingStatus,
      billingInterval,
      currentPeriodEnd: (org?.currentPeriodEnd as string | undefined) ?? null,
      trialEndsAt: (org?.trialEndsAt as string | undefined) ?? null,
      isPaymentPastDue: !!org?.isPaymentPastDue,
      stripeConnectStatus: (org?.stripeConnectStatus as string | undefined) ?? 'not_connected',
      clientCount,
      maxClients: maxClients === Infinity ? null : maxClients,
      isAtLimit: maxClients !== Infinity && clientCount >= maxClients,
      isNearLimit: maxClients !== Infinity && clientCount >= maxClients * 0.8,
      canManageBilling: canManageOrganizationBilling(session.user.role),
      canConnectStripe: canManageOrganizationBilling(session.user.role) && isStripeConnectConfigured(),
      portalAvailable: !!org?.stripeCustomerId && isStripeConfigured(),
      checkoutAvailable: plans.some((item) => item.active && !item.isFree),
      allowWorkspace: access.allowWorkspace,
      allowPremiumFeatures: access.allowPremiumFeatures,
      billingCatalog: plans
        .filter((item) => item.active && !item.isFree)
        .map((item) => ({
          key: item.key,
          checkoutKey: item.checkoutKey,
          name: item.name,
          interval: item.interval,
          amountLabel: item.amountLabel,
          isCurrent: billingPlan === item.key && billingInterval === item.interval && (billingStatus === 'active' || billingStatus === 'trialing'),
        })),
    })
  } catch (err: any) {
    console.error('[GET /api/org]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
