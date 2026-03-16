import { deriveEffectivePlan, getBillingAccess, normalizeBillingStatus, type BillingPlanKey, type BillingStatus } from './billingCore.ts'
import { canAccessOrganizationAdmin, hasOrganizationScopedAccess, type OrganizationPermissionIdentity } from './organizationAccess.ts'
import { hasOrganizationFeatureAccess, type OrganizationFeatureOverride } from './organizationFeatures.ts'

export interface AppEntitlementsInput extends OrganizationPermissionIdentity {
  billingStatus?: string | null
  billingPlan?: string | null
  storedPlan?: string | null
  featureOverride?: OrganizationFeatureOverride | null
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
  const fullAccessOverride = input.featureOverride?.fullAccess === true
  const allowPremiumFeatures = billingAccess.allowPremiumFeatures || fullAccessOverride
  const canAccessReports =
    (allowPremiumFeatures || hasOrganizationFeatureAccess(input.featureOverride, 'reports')) &&
    hasOrgAccess
  const canAccessBranches =
    allowPremiumFeatures || hasOrganizationFeatureAccess(input.featureOverride, 'branches')

  return {
    billingStatus,
    effectivePlan,
    allowPremiumFeatures,
    canAccessReports,
    canAccessBranches,
    canAccessAdmin,
  }
}

export function canAccessTab(
  tab: string,
  entitlements: Pick<AppEntitlements, 'canAccessReports' | 'canAccessBranches' | 'canAccessAdmin'>,
) {
  if (tab === 'admin') return entitlements.canAccessAdmin
  if (tab === 'reports') return entitlements.canAccessReports
  if (tab === 'branches') return entitlements.canAccessBranches
  return true
}
