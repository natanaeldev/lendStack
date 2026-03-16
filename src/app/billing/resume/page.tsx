'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LendStackLogo from '@/components/LendStackLogo'

export default function BillingResumePage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    async function resumeCheckout() {
      try {
        const orgRes = await fetch('/api/org')
        const org = await orgRes.json()

        if (org.billingStatus !== 'pending_checkout') {
          router.replace('/app')
          return
        }

        const checkoutRes = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planKey: org.billingPlan ?? 'starter',
            interval: org.billingInterval ?? 'month',
          }),
        })
        const checkout = await checkoutRes.json()

        if (checkout.url) {
          window.location.href = checkout.url
        } else {
          setError(checkout.error ?? 'No se pudo iniciar el checkout.')
        }
      } catch {
        setError('Error al conectar con el servidor.')
      }
    }

    resumeCheckout()
  }, [router])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #071a3e 0%, #0D2B5E 55%, #1565C0 100%)' }}
    >
      <LendStackLogo variant="light" size={48} />

      <div
        className="mt-8 bg-white rounded-2xl p-8 w-full max-w-sm text-center"
        style={{ boxShadow: '0 8px 48px rgba(0,0,0,.35)' }}
      >
        {error ? (
          <>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <a
              href="/app/billing"
              className="text-sm font-semibold underline"
              style={{ color: '#1565C0' }}
            >
              Ir a Billing para intentarlo manualmente
            </a>
          </>
        ) : (
          <>
            <div
              className="h-8 w-8 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
              style={{ borderColor: '#1565C0', borderTopColor: 'transparent' }}
            />
            <p className="font-semibold text-slate-800">Redirigiendo a Stripe Checkout...</p>
            <p className="text-slate-400 text-sm mt-2">Espera un momento.</p>
          </>
        )}
      </div>
    </div>
  )
}
