import { NextResponse } from 'next/server'
import { getDb, isDbConfigured } from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { canManageOrganizationBilling, getBillingAccess } from '@/lib/billingCore'
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

    const clientCount = await db.collection('clients').countDocuments({
      organizationId: session.user.organizationId,
    })

    const limits = {
      starter: { maxClients: 50 },
      pro: { maxClients: Infinity },
      enterprise: { maxClients: Infinity },
    }
    const maxClients = (limits[plan as keyof typeof limits] ?? limits.starter).maxClients
    const plans = getBillingPlans()
    const proPlan = plans.find((item) => item.key === 'pro')

    return NextResponse.json({
      orgId: String(org?._id ?? session.user.organizationId),
      orgName: (org?.name as string | undefined) ?? '',
      plan,
      billingPlan,
      billingStatus,
      billingInterval: (org?.billingInterval as string | undefined) ?? null,
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
      checkoutAvailable: !!proPlan?.active && isStripeConfigured(),
      allowWorkspace: access.allowWorkspace,
      allowPremiumFeatures: access.allowPremiumFeatures,
    })
  } catch (err: any) {
    console.error('[GET /api/org]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
