import { getDb } from '@/lib/mongodb'
import { deriveAppEntitlements } from '@/lib/appAccess'

export async function getOrganizationBillingAccess(organizationId: string, role?: string | null) {
  const db = await getDb()
  const organization = await db.collection('organizations').findOne({
    _id: organizationId as any,
  })

  const billingStatus = (organization?.billingStatus as string | undefined) ?? 'active'
  const billingPlan = (organization?.billingPlan as string | undefined) ?? (organization?.plan as string | undefined) ?? 'starter'
  const entitlements = deriveAppEntitlements({
    role,
    billingStatus,
    billingPlan,
    storedPlan: (organization?.plan as string | undefined) ?? 'starter',
  })

  return {
    billingStatus: entitlements.billingStatus,
    billingPlan,
    effectivePlan: entitlements.effectivePlan,
    allowPremiumFeatures: entitlements.allowPremiumFeatures,
    canAccessReports: entitlements.canAccessReports,
    canAccessBranches: entitlements.canAccessBranches,
    canAccessAdmin: entitlements.canAccessAdmin,
  }
}
