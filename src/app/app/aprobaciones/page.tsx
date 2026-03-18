'use client'

import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect }  from 'react'
import ApproverInbox  from '@/components/reauth/ApproverInbox'

export default function AprobacionesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status])

  const canApprove =
    session?.user?.role === 'master' ||
    session?.user?.isOrganizationOwner ||
    session?.user?.role === 'manager' ||
    (session?.user?.organizationRole ?? '').toUpperCase() === 'MANAGER'

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Gestión</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Aprobaciones pendientes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Préstamos que superaron el umbral y requieren su aprobación para proceder al desembolso.
        </p>
      </div>
      {!canApprove ? (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center">
          <p className="text-slate-500">No tiene permisos para ver aprobaciones.</p>
        </div>
      ) : (
        <ApproverInbox />
      )}
    </div>
  )
}
