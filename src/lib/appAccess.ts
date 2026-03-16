// @ts-expect-error TS5097: explicit .ts import keeps Node strip-types tests aligned with the app helper.
import { deriveEffectivePlan, getBillingAccess, normalizeBillingStatus, type BillingPlanKey, type BillingStatus } from './billingCore.ts'

export interface AppEntitlementsInput {
  role?: string | null
  billingStatus?: string | null
  billingPlan?: string | null
  storedPlan?: string | null
}

export interface AppEntitlements {
  billingStatus: BillingStatus
  effectivePlan: BillingPlanKey
  allowPremiumFeatures: boolean
  canAccessReports: boolean
  canAccessBranches: boolean
  canAccessAdmin: boolean
}

export function canAccessAdminRole(role?: string | null) {
  return role === 'master'
}

export function deriveAppEntitlements(input: AppEntitlementsInput): AppEntitlements {
  const billingStatus = normalizeBillingStatus(input.billingStatus)
  const billingAccess = getBillingAccess(billingStatus)
  const billingPlan = (input.billingPlan ?? input.storedPlan ?? 'starter') as BillingPlanKey
  const effectivePlan = deriveEffectivePlan(billingPlan, billingStatus)
  const canAccessAdmin = billingAccess.allowPremiumFeatures && canAccessAdminRole(input.role)

  return {
    billingStatus,
    effectivePlan,
    allowPremiumFeatures: billingAccess.allowPremiumFeatures,
    canAccessReports: billingAccess.allowPremiumFeatures,
    canAccessBranches: billingAccess.allowPremiumFeatures,
    canAccessAdmin,
  }
}

export function canAccessTab(
  tab: string,
  entitlements: Pick<AppEntitlements, 'allowPremiumFeatures' | 'canAccessAdmin'>,
) {
  if (tab === 'admin') return entitlements.canAccessAdmin
  if (tab === 'reports' || tab === 'branches') return entitlements.allowPremiumFeatures
  return true
}
