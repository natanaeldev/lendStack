import { getDb } from '@/lib/mongodb'
import { hasPremiumAccessFromStatus } from '@/lib/premiumAccess'

export async function getOrganizationBillingAccess(organizationId: string) {
  const db = await getDb()
  const organization = await db.collection('organizations').findOne({
    _id: organizationId as any,
  })

  const billingStatus = (organization?.billingStatus as string | undefined) ?? 'active'

  return {
    billingStatus,
    allowPremiumFeatures: hasPremiumAccessFromStatus(billingStatus),
  }
}
