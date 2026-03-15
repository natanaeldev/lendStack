'use client'

import { useEffect, useMemo, useState } from 'react'

type BillingPlanCard = {
  key: string
  checkoutKey: string
  name: string
  interval: string | null
  amountLabel: string
  isCurrent: boolean
}

type OrgBillingState = {
  orgName: string
  plan: string
  billingPlan?: string
  billingStatus?: string
  billingInterval?: string | null
  currentPeriodEnd?: string | null
  isPaymentPastDue?: boolean
  canManageBilling?: boolean
  canConnectStripe?: boolean
  portalAvailable?: boolean
  stripeConnectStatus?: string
  billingCatalog?: BillingPlanCard[]
}

function formatPeriodLabel(value?: string | null) {
  if (!value) return 'Sin renovacion programada'
  try {
    return new Intl.DateTimeFormat('es-DO', {
      dateStyle: 'medium',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export default function BillingPage() {
  const [orgInfo, setOrgInfo] = useState<OrgBillingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/org')
      .then((response) => response.json())
      .then((json) => {
        if (!json.error) setOrgInfo(json)
        else setError(json.error)
      })
      .catch(() => setError('No se pudo cargar la informacion de billing.'))
      .finally(() => setLoading(false))
  }, [])

  const currentPlanLabel = useMemo(() => {
    if (!orgInfo) return 'Sin plan'
    const interval = orgInfo.billingInterval === 'year' ? 'anual' : orgInfo.billingInterval === 'month' ? 'mensual' : 'sin ciclo'
    return `${orgInfo.billingPlan ?? orgInfo.plan} · ${interval}`
  }, [orgInfo])

  async function openBillingFlow(kind: 'checkout' | 'portal' | 'connect', endpoint: string, payload?: Record<string, unknown>) {
    try {
      setError('')
      setActionLoading(kind)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
      })
      const json = await response.json()
      if (!response.ok || !json.url) {
        throw new Error(json.error || 'No se pudo abrir el flujo de billing.')
      }
      window.location.href = json.url
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'No se pudo abrir el flujo de billing.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,.05)] sm:px-8 sm:py-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Billing</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-slate-950">Suscripcion de LendStack</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Checkout y portal de Stripe con sincronizacion por webhook. El acceso premium solo se activa cuando Stripe confirma el estado de la suscripcion.
          </p>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,.05)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Estado actual</p>
            {loading ? (
              <div className="mt-4 h-28 animate-pulse rounded-3xl bg-slate-100" />
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Organizacion</p>
                  <p className="text-xl font-black text-slate-950">{orgInfo?.orgName || 'No disponible'}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Plan</p>
                    <p className="mt-1 text-sm font-bold text-slate-950">{currentPlanLabel}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Estado</p>
                    <p className="mt-1 text-sm font-bold text-slate-950">{orgInfo?.billingStatus || 'No disponible'}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Renovacion</p>
                    <p className="mt-1 text-sm font-bold text-slate-950">{formatPeriodLabel(orgInfo?.currentPeriodEnd)}</p>
                  </div>
                </div>
                {orgInfo?.isPaymentPastDue ? (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Stripe reporto un cobro pendiente. El workspace sigue visible, pero debes actualizar el metodo de pago cuanto antes.
                  </div>
                ) : null}
                {orgInfo?.canManageBilling ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {orgInfo.portalAvailable ? (
                      <button
                        type="button"
                        onClick={() => openBillingFlow('portal', '/api/billing/portal')}
                        disabled={actionLoading !== null}
                        className="min-h-12 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 disabled:opacity-50"
                      >
                        {actionLoading === 'portal' ? 'Abriendo portal...' : 'Gestionar billing'}
                      </button>
                    ) : null}
                    {orgInfo.canConnectStripe ? (
                      <button
                        type="button"
                        onClick={() => openBillingFlow('connect', '/api/billing/connect')}
                        disabled={actionLoading !== null}
                        className="min-h-12 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 disabled:opacity-50"
                      >
                        {actionLoading === 'connect'
                          ? 'Conectando Stripe...'
                          : orgInfo.stripeConnectStatus === 'active'
                            ? 'Stripe conectado'
                            : 'Conectar Stripe'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,.05)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Catalogo</p>
            <h2 className="mt-2 text-lg font-black text-slate-950">Planes disponibles</h2>
            <p className="mt-2 text-sm text-slate-600">
              Selecciona un precio de Stripe. El acceso premium se habilita cuando el webhook confirma la suscripcion.
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {(orgInfo?.billingCatalog ?? []).map((plan) => (
            <article key={plan.checkoutKey} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,.05)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {plan.interval === 'year' ? 'Facturacion anual' : 'Facturacion mensual'}
                  </p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{plan.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{plan.amountLabel}</p>
                </div>
                {plan.isCurrent ? (
                  <span className="inline-flex min-h-10 items-center rounded-full bg-emerald-50 px-4 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                    Plan actual
                  </span>
                ) : null}
              </div>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => openBillingFlow('checkout', '/api/billing/checkout', { planKey: plan.key, interval: plan.interval })}
                  disabled={actionLoading !== null || plan.isCurrent || !orgInfo?.canManageBilling}
                  className="min-h-12 w-full rounded-2xl bg-slate-950 px-5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {actionLoading === 'checkout' ? 'Abriendo checkout...' : plan.isCurrent ? 'Plan actual' : 'Suscribirse con Stripe'}
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
