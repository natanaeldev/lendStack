import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { HomeWithTab } from '../page'
import { authOptions } from '@/lib/auth'
import { getOrganizationBillingAccess } from '@/lib/serverBillingAccess'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    redirect('/login')
  }

  const access = await getOrganizationBillingAccess(session.user.organizationId)
  if (!access.allowPremiumFeatures) {
    redirect('/app/billing?required=premium')
  }

  return <HomeWithTab initialTab="admin" />
}
