'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import LendStackLogo from '@/components/LendStackLogo'
import { getOrganizationCreationEndpoint } from '@/lib/organizationFlow'

type AvailablePlan = {
  key: string
  productKey: string
  name: string
  description: string
  interval: 'month' | 'year'
  badge?: string | null
  amountLabel: string
  features: string[]
}

type PendingDraft = {
  orgName: string
  adminName: string
  adminEmail: string
  planKey: string
}

const PENDING_ORG_STORAGE_KEY = 'pending-org-registration'

function intervalLabel(interval: 'month' | 'year') {
  return interval === 'year' ? 'Anual' : 'Mensual'
}

function readPendingDraft(): PendingDraft | null {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(PENDING_ORG_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as PendingDraft
  } catch {
    window.localStorage.removeItem(PENDING_ORG_STORAGE_KEY)
    return null
  }
}

function writePendingDraft(draft: PendingDraft) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PENDING_ORG_STORAGE_KEY, JSON.stringify(draft))
}

function clearPendingDraft() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PENDING_ORG_STORAGE_KEY)
}

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status, update } = useSession()
  const isAuthenticated = status === 'authenticated'

  const [step, setStep] = useState<1 | 2>(1)
  const [orgName, setOrgName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [plans, setPlans] = useState<AvailablePlan[]>([])
  const [selectedPlanKey, setSelectedPlanKey] = useState('')
  const [plansLoading, setPlansLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    fetch('/api/register/plans')
      .then((response) => response.json())
      .then((json) => {
        const nextPlans = Array.isArray(json.plans) ? json.plans : []
        setPlans(nextPlans)
        setSelectedPlanKey((current) => current || nextPlans[0]?.key || '')
      })
      .catch(() => setError('No se pudieron cargar los planes disponibles.'))
      .finally(() => setPlansLoading(false))
  }, [])

  useEffect(() => {
    if (!session?.user) return

    setAdminEmail(session.user.email ?? '')
    setAdminName((current) => current || session.user.name || '')
  }, [session])

  useEffect(() => {
    const shouldResume = searchParams.get('resume') === '1'
    if (!shouldResume) return

    const draft = readPendingDraft()
    if (!draft) return

    setOrgName(draft.orgName)
    setAdminName((current) => current || draft.adminName)
    setAdminEmail((current) => current || draft.adminEmail)
    setSelectedPlanKey((current) => current || draft.planKey)
    setStep(2)

    if (isAuthenticated) {
      setSuccessMsg('Sesion iniciada. Revisa el plan y continua con la creacion de la organizacion.')
    }
  }, [isAuthenticated, searchParams])

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === selectedPlanKey) ?? null,
    [plans, selectedPlanKey],
  )

  const validateStepOne = () => {
    if (!orgName.trim()) {
      setError('Ingresa el nombre de tu organizacion.')
      return false
    }
    if (!adminEmail.trim()) {
      setError('El email es obligatorio.')
      return false
    }
    if (!isAuthenticated && password.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres.')
      return false
    }
    if (!isAuthenticated && password !== confirm) {
      setError('Las contrasenas no coinciden.')
      return false
    }
    if (!selectedPlanKey) {
      setError('Selecciona un plan para continuar.')
      return false
    }
    return true
  }

  const handleNext = (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!validateStepOne()) return
    setStep(2)
  }

  const handleSubmit = async () => {
    if (loading || !selectedPlanKey) return

    setLoading(true)
    setError('')

    const pendingDraft: PendingDraft = {
      orgName,
      adminName,
      adminEmail,
      planKey: selectedPlanKey,
    }

    try {
      const endpoint = getOrganizationCreationEndpoint(isAuthenticated)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName,
          adminName,
          adminEmail,
          password: isAuthenticated ? undefined : password,
          planKey: selectedPlanKey,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        if (data.errorCode === 'use_organization_creation_endpoint') {
          setError('La sesion ya esta iniciada. Reintenta crear la organizacion desde tu cuenta actual.')
          return
        }
        if (data.errorCode === 'existing_user_requires_login' || data.errorCode === 'incomplete_onboarding' || data.errorCode === 'conflict') {
          writePendingDraft(pendingDraft)
          router.push(`/login?next=${encodeURIComponent('/billing/resume')}&reason=org-create`)
          return
        }

        setError(data.error ?? 'Error al registrar la organizacion.')
        if (data.errorCode === 'organization_exists' || data.errorCode === 'membership_exists') {
          setStep(1)
        }
        return
      }

      if (data.checkoutUrl) {
        // Keep the draft alive so the user can resume if they cancel Stripe checkout
        writePendingDraft(pendingDraft)
        window.location.href = data.checkoutUrl
        return
      }

      clearPendingDraft()

      if (data.warning) setSuccessMsg(data.warning)

      if (data.requiresLogin) {
        router.push('/login?registered=1')
        return
      }

      if (isAuthenticated) {
        await update()
      }

      router.push('/app?onboarding=1')
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor.')
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #071a3e 0%, #0D2B5E 55%, #1565C0 100%)' }}
    >
      <div
        className="fixed inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '38px 38px',
        }}
      />

      <div className="relative z-10 flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-5xl">
          <div className="mb-8 flex justify-center">
            <div
              className="rounded-2xl flex-shrink-0"
              style={{ background: 'rgba(255,255,255,.95)', padding: '10px 20px', boxShadow: '0 4px 32px rgba(0,0,0,.3)' }}
            >
              <LendStackLogo variant="dark" size={42} />
            </div>
          </div>

          <div className="mb-6 flex items-center justify-center gap-3">
            {[1, 2].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all"
                  style={{
                    background: step >= stepNumber ? '#1565C0' : 'rgba(255,255,255,.2)',
                    color: step >= stepNumber ? '#fff' : 'rgba(255,255,255,.5)',
                  }}
                >
                  {stepNumber}
                </div>
                {stepNumber < 2 ? (
                  <div className="h-0.5 w-12 rounded" style={{ background: step > stepNumber ? '#1565C0' : 'rgba(255,255,255,.2)' }} />
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-2xl bg-white p-8 shadow-[0_8px_48px_rgba(0,0,0,.35)]">
              {step === 1 ? (
                <>
                  <h2 className="mb-1 text-2xl font-bold" style={{ color: '#0D2B5E', fontFamily: "'DM Sans', sans-serif" }}>
                    Crear organizacion
                  </h2>
                  <p className="mb-6 text-sm text-slate-400">
                    Registra tu empresa. El email owner sera la cuenta maestra de la organizacion.
                  </p>

                  {isAuthenticated ? (
                    <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                      Estas creando una organizacion con tu sesion actual. El email owner queda fijado a esta cuenta.
                    </div>
                  ) : null}

                  <form onSubmit={handleNext} className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Nombre de la organizacion *
                      </label>
                      <input
                        type="text"
                        value={orgName}
                        onChange={(event) => setOrgName(event.target.value)}
                        placeholder="Ej: Creditos Rapidos SRL"
                        autoComplete="organization"
                        className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none"
                        style={{ color: '#374151' }}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Tu nombre
                      </label>
                      <input
                        type="text"
                        value={adminName}
                        onChange={(event) => setAdminName(event.target.value)}
                        placeholder="Ej: Maria Garcia"
                        autoComplete="name"
                        className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none"
                        style={{ color: '#374151' }}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Email owner *
                      </label>
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(event) => setAdminEmail(event.target.value)}
                        placeholder="admin@tuempresa.com"
                        required
                        autoComplete="email"
                        disabled={isAuthenticated}
                        className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                        style={{ color: '#374151' }}
                      />
                    </div>

                    {!isAuthenticated ? (
                      <>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Contrasena * <span className="font-normal normal-case text-slate-400">(min. 8 caracteres)</span>
                          </label>
                          <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="********"
                            required
                            autoComplete="new-password"
                            className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none"
                            style={{ color: '#374151' }}
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Confirmar contrasena *
                          </label>
                          <input
                            type="password"
                            value={confirm}
                            onChange={(event) => setConfirm(event.target.value)}
                            placeholder="********"
                            required
                            autoComplete="new-password"
                            className={`w-full rounded-xl border-2 px-4 py-3 text-sm transition-colors focus:outline-none ${
                              confirm && confirm !== password ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
                            }`}
                            style={{ color: '#374151' }}
                          />
                        </div>
                      </>
                    ) : null}

                    {error ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={!orgName || !adminEmail || (!isAuthenticated && (!password || !confirm || password !== confirm)) || plansLoading || !selectedPlanKey}
                      className="mt-2 w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}
                    >
                      Siguiente: confirmar plan
                    </button>
                  </form>

                  <p className="mt-5 text-center text-xs text-slate-400">
                    Ya tienes cuenta?{' '}
                    <Link href="/login" className="font-semibold hover:underline" style={{ color: '#1565C0' }}>
                      Iniciar sesion
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setStep(1)}
                    className="mb-4 flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700"
                  >
                    Volver
                  </button>

                  <h2 className="mb-1 text-2xl font-bold" style={{ color: '#0D2B5E', fontFamily: "'DM Sans', sans-serif" }}>
                    Confirmar suscripcion
                  </h2>
                  <p className="mb-6 text-sm text-slate-400">
                    Crearemos la organizacion y luego te llevaremos a Stripe Checkout con el plan seleccionado.
                  </p>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Plan seleccionado</p>
                    <p className="mt-2 text-lg font-black text-slate-950">
                      {selectedPlan ? `${selectedPlan.name} · ${intervalLabel(selectedPlan.interval)}` : 'No disponible'}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{selectedPlan?.description ?? 'Selecciona un plan valido.'}</p>
                  </div>

                  {successMsg ? (
                    <div className="mb-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      {successMsg}
                    </div>
                  ) : null}
                  {error ? (
                    <div className="mb-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {error}
                    </div>
                  ) : null}

                  <button
                    onClick={handleSubmit}
                    disabled={loading || !selectedPlan}
                    className="mt-5 w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}
                  >
                    {loading ? 'Creando organizacion...' : 'Continuar a Stripe Checkout'}
                  </button>
                </>
              )}
            </div>

            <div className="rounded-2xl bg-white/95 p-6 shadow-[0_8px_48px_rgba(0,0,0,.25)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Planes disponibles</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Catalogo conectado a Stripe</h3>
              <p className="mt-3 text-sm text-slate-600">
                Selecciona el plan que quieres activar durante el onboarding.
              </p>

              {plansLoading ? (
                <div className="mt-6 space-y-3">
                  <div className="h-28 animate-pulse rounded-3xl bg-slate-100" />
                  <div className="h-28 animate-pulse rounded-3xl bg-slate-100" />
                </div>
              ) : plans.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  No hay planes Stripe activos en este entorno. Revisa los price IDs en Vercel.
                </div>
              ) : (
                <div className="mt-6 grid gap-3">
                  {plans.map((plan) => {
                    const selected = plan.key === selectedPlanKey
                    return (
                      <button
                        key={plan.key}
                        type="button"
                        onClick={() => setSelectedPlanKey(plan.key)}
                        className="rounded-[24px] border-2 p-4 text-left transition-all"
                        style={{
                          borderColor: selected ? '#1565C0' : '#E2E8F0',
                          background: selected ? '#EFF6FF' : '#fff',
                        }}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-base font-black text-slate-950">
                                {plan.name} · {intervalLabel(plan.interval)}
                              </p>
                              {plan.badge ? (
                                <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                                  {plan.badge}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white">
                            {plan.amountLabel}
                          </div>
                        </div>
                        <ul className="mt-4 space-y-2">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                              <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-xs" style={{ color: 'rgba(255,255,255,.35)' }}>
            LendStack · Sistema de gestion de prestamos
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  )
}
