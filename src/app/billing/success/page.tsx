'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function BillingSuccessPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<{ status?: string; paymentStatus?: string } | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }

    fetch(`/api/billing/checkout-session?session_id=${encodeURIComponent(sessionId)}`)
      .then((response) => response.json())
      .then((json) => setSummary(json))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }, [sessionId])

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-20 text-white">
      <div className="mx-auto max-w-xl rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_rgba(0,0,0,.35)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-200">Facturación</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.03em]">Checkout recibido</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          La confirmación final del plan depende del webhook de Stripe. Si el pago ya fue procesado, la organización se activará automáticamente.
        </p>

        <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/70 px-5 py-4 text-sm text-slate-200">
          {loading ? 'Verificando la sesión con Stripe...' : summary ? `Estado checkout: ${summary.status ?? '—'} · Pago: ${summary.paymentStatus ?? '—'}` : 'No se pudo validar la sesión automáticamente. Inicia sesión y revisa el estado de facturación.'}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-bold text-slate-950"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 px-5 text-sm font-semibold text-white"
          >
            Volver al registro
          </Link>
        </div>
      </div>
    </main>
  )
}
