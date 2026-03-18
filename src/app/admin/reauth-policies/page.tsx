import { redirect } from 'next/navigation'

export default function LegacyReauthPoliciesPage() {
  redirect('/app/admin/reauth-policies')
}
