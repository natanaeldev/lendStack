// @ts-expect-error TS5097: explicit .ts import keeps Node strip-types tests aligned with the app helper.
import { deriveEffectivePlan, getBillingAccess, normalizeBillingStatus, type BillingPlanKey, type BillingStatus } from './billingCore.ts'
// @ts-expect-error TS5097: explicit .ts import keeps Node strip-types tests aligned with the app helper.
import { canAccessOrganizationAdmin, hasOrganizationScopedAccess, type OrganizationPermissionIdentity } from './organizationAccess.ts'

export interface AppEntitlementsInput extends OrganizationPermissionIdentity {
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

export function canAccessAdminRole(input?: string | OrganizationPermissionIdentity | null) {
  if (typeof input === 'string' || input == null) {
    return canAccessOrganizationAdmin({ role: input ?? undefined })
  }
  return canAccessOrganizationAdmin(input)
}

export function deriveAppEntitlements(input: AppEntitlementsInput): AppEntitlements {
  const billingStatus = normalizeBillingStatus(input.billingStatus)
  const billingAccess = getBillingAccess(billingStatus)
  const billingPlan = (input.billingPlan ?? input.storedPlan ?? 'starter') as BillingPlanKey
  const effectivePlan = deriveEffectivePlan(billingPlan, billingStatus)
  const hasOrgAccess = hasOrganizationScopedAccess(input)
  const canAccessAdmin = canAccessAdminRole(input)

  return {
    billingStatus,
    effectivePlan,
    allowPremiumFeatures: billingAccess.allowPremiumFeatures,
    canAccessReports: billingAccess.allowPremiumFeatures && hasOrgAccess,
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
