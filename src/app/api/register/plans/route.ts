import { NextResponse } from 'next/server'
import { getAvailableBillingPlans } from '@/lib/billingPlans'

export async function GET() {
  const plans = getAvailableBillingPlans().map((plan) => ({
    key: plan.key,
    productKey: plan.productKey,
    name: plan.name,
    description: plan.description,
    interval: plan.interval,
    badge: plan.badge ?? null,
    amountLabel: plan.amountLabel,
    features: plan.features,
  }))

  return NextResponse.json({ plans })
}
