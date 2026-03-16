import { getBillingAccess, normalizeBillingStatus } from '@/lib/billingCore'

export const PREMIUM_TABS = new Set(['branches', 'reports'])
export const ADMIN_TABS = new Set(['admin'])

export function isPremiumTab(tab: string) {
  return PREMIUM_TABS.has(tab)
}

export function isAdminTab(tab: string) {
  return ADMIN_TABS.has(tab)
}

export function hasPremiumAccessFromStatus(status: string | null | undefined) {
  return getBillingAccess(normalizeBillingStatus(status)).allowPremiumFeatures
}
