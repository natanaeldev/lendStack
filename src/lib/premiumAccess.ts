import { getBillingAccess, normalizeBillingStatus } from '@/lib/billingCore'

export const PREMIUM_TABS = new Set(['branches', 'reports', 'admin'])

export function isPremiumTab(tab: string) {
  return PREMIUM_TABS.has(tab)
}

export function hasPremiumAccessFromStatus(status: string | null | undefined) {
  return getBillingAccess(normalizeBillingStatus(status)).allowPremiumFeatures
}
