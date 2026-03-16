import { getDb } from '@/lib/mongodb'
import { deriveAppEntitlements } from '@/lib/appAccess'
import { deriveOrganizationFeatureOverride } from '@/lib/organizationFeatures'

export async function getOrganizationBillingAccess(
  organizationId: string,
  role?: string | null,
  options: { organizationRole?: string | null; isOrganizationOwner?: boolean | null } = {},
) {
  const db = await getDb()
  const organization = await db.collection('organizations').findOne({
    _id: organizationId as any,
  })

  const billingStatus = (organization?.billingStatus as string | undefined) ?? 'active'
  const billingPlan = (organization?.billingPlan as string | undefined) ?? (organization?.plan as string | undefined) ?? 'starter'
  const featureOverride = deriveOrganizationFeatureOverride(organization as any)
  const entitlements = deriveAppEntitlements({
    role,
    organizationRole: options.organizationRole,
    isOrganizationOwner: options.isOrganizationOwner,
    billingStatus,
    billingPlan,
    storedPlan: (organization?.plan as string | undefined) ?? 'starter',
    featureOverride,
  })

  return {
    billingStatus: entitlements.billingStatus,
    billingPlan,
    effectivePlan: entitlements.effectivePlan,
    featureOverride,
    allowPremiumFeatures: entitlements.allowPremiumFeatures,
    canAccessReports: entitlements.canAccessReports,
    canAccessBranches: entitlements.canAccessBranches,
    canAccessAdmin: entitlements.canAccessAdmin,
  }
}
