'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import LendStackLogo from '@/components/LendStackLogo'

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
  const sessionLoading = status === 'loading'

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

  // orgCreatedId is set after a successful POST /api/organizations.
  // It is passed to POST /api/billing/checkout so the checkout can target
  // the newly-created org even before the JWT has been refreshed.
  const [orgCreatedId, setOrgCreatedId] = useState<string | null>(null)

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
      setSuccessMsg('Sesión iniciada. Revisá el plan y continuá con la creación de la organización.')
    }
  }, [isAuthenticated, searchParams])

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === selectedPlanKey) ?? null,
    [plans, selectedPlanKey],
  )

  const validateStepOne = () => {
    if (!orgName.trim()) {
      setError('Ingresá el nombre de tu organización.')
      return false
    }
    if (!adminEmail.trim()) {
      setError('El email es obligatorio.')
      return false
    }
    if (!isAuthenticated && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return false
    }
    if (!isAuthenticated && password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return false
    }
    return true
  }

  // ── Step 1 handler ──────────────────────────────────────────────────────────
  // For authenticated users:  creates the org via POST /api/organizations and
  // then advances to plan selection (step 2).
  // For unauthenticated users: validates and advances to plan confirmation (step 2)
  // without making any API call — the API call happens on step 2 submit.
  const handleNext = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!validateStepOne()) return

    if (isAuthenticated) {
      // Authenticated path: create the org now, select plan in step 2.
      setLoading(true)
      try {
        const response = await fetch('/api/organizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgName, adminName }),
        })
        const data = await response.json()

        if (!response.ok) {
          const code = data.errorCode as string | undefined
          if (code === 'organization_exists') {
            setError('Ya existe una organización con ese nombre. Elegí un nombre diferente.')
            return
          }
          if (code === 'membership_exists') {
            setError('Ya pertenecés a una organización activa. Ingresá al panel para administrarla.')
            return
          }
          if (code === 'email_conflict') {
            setError('Ese email ya está en uso por otra cuenta.')
            return
          }
          setError(data.error ?? 'No se pudo crear la organización.')
          return
        }

        setOrgCreatedId(data.organizationId)
        setStep(2)
      } catch {
        setError('No se pudo conectar con el servidor.')
      } finally {
        setLoading(false)
      }
    } else {
      // Unauthenticated path: plan selection happens here in the sidebar; the
      // combined register+checkout call fires on step 2 submit.
      setStep(2)
    }
  }

  // ── Step 2 handler ──────────────────────────────────────────────────────────
  // For authenticated users (org already created): calls POST /api/billing/checkout
  // with the organizationId from step 1 + the selected plan.
  // For unauthenticated users: calls POST /api/register which creates user + org +
  // Stripe checkout in one atomic operation.
  const handleSubmit = async () => {
    if (loading) return

    setLoading(true)
    setError('')

    const pendingDraft: PendingDraft = {
      orgName,
      adminName,
      adminEmail,
      planKey: selectedPlanKey,
    }

    try {
      if (isAuthenticated && orgCreatedId) {
        // ── Authenticated flow: create Stripe checkout for the org we just created ──
        if (!selectedPlan) {
          setError('Seleccioná un plan para continuar.')
          return
        }

        const response = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgCreatedId,
            planKey: selectedPlan.productKey,
            interval: selectedPlan.interval,
          }),
        })
        const data = await response.json()

        if (!response.ok) {
          if (data.errorCode === 'invalid_plan') {
            setError('El plan seleccionado no está disponible. Elegí otro plan.')
          } else {
            setError(data.error ?? 'No se pudo iniciar el checkout.')
          }
          return
        }

        if (data.url) {
          writePendingDraft(pendingDraft)
          window.location.href = data.url
          return
        }

        // Stripe configured but returned no URL (shouldn't happen in practice)
        setError('No se pudo obtener la URL de Stripe. Intentalo de nuevo.')
        return
      }

      // ── Unauthenticated flow: create user + org + checkout atomically ──
      if (!selectedPlanKey) {
        setError('Seleccioná un plan para continuar.')
        return
      }

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName,
          adminName,
          adminEmail,
          password,
          planKey: selectedPlanKey,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        // Redirect unauthenticated users to login when the conflict means "you
        // already have an account — log in to resume."  Never redirect when already
        // authenticated (would create an infinite loop).
        if (
          data.errorCode === 'existing_user_requires_login' ||
          data.errorCode === 'incomplete_onboarding' ||
          data.errorCode === 'conflict'
        ) {
          writePendingDraft(pendingDraft)
          const loginUrl =
            `/login?next=${encodeURIComponent('/register?resume=1')}&reason=org-create` +
            (adminEmail ? `&email=${encodeURIComponent(adminEmail)}` : '')
          router.push(loginUrl)
          return
        }

        setError(data.error ?? 'Error al registrar la organización.')
        // Reset to step 1 for conflicts that require changing org name or email.
        if (
          data.errorCode === 'organization_exists' ||
          data.errorCode === 'membership_exists' ||
          data.errorCode === 'email_conflict'
        ) {
          setStep(1)
        }
        return
      }

      if (data.checkoutUrl) {
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
      setStep(isAuthenticated ? 2 : 2)
    } finally {
      setLoading(false)
    }
  }

  // The "Siguiente" / "Crear organización" button is disabled while the session
  // status is still being resolved to avoid routing to the wrong endpoint.
  const step1SubmitDisabled =
    sessionLoading ||
    !orgName ||
    !adminEmail ||
    (!isAuthenticated && (!password || !confirm || password !== confirm)) ||
    loading

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
                    Crear organización
                  </h2>
                  <p className="mb-6 text-sm text-slate-400">
                    {isAuthenticated
                      ? 'Ingresá el nombre de la organización y te llevamos a elegir el plan.'
                      : 'Registrá tu empresa. El email owner será la cuenta maestra de la organización.'}
                  </p>

                  {isAuthenticated ? (
                    <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                      Estás creando una organización con tu sesión actual. El email owner queda fijado a esta cuenta.
                    </div>
                  ) : null}

                  {sessionLoading ? (
                    <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      Verificando sesión…
                    </div>
                  ) : null}

                  <form onSubmit={handleNext} className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Nombre de la organización *
                      </label>
                      <input
                        type="text"
                        value={orgName}
                        onChange={(event) => setOrgName(event.target.value)}
                        placeholder="Ej: Créditos Rápidos SRL"
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
                        placeholder="Ej: María García"
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
                            Contraseña * <span className="font-normal normal-case text-slate-400">(mín. 8 caracteres)</span>
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
                            Confirmar contraseña *
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
                      disabled={step1SubmitDisabled}
                      className="mt-2 w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}
                    >
                      {loading
                        ? 'Creando organización…'
                        : isAuthenticated
                          ? 'Crear organización'
                          : 'Siguiente: seleccionar plan'}
                    </button>
                  </form>

                  <p className="mt-5 text-center text-xs text-slate-400">
                    ¿Ya tenés cuenta?{' '}
                    <Link href="/login" className="font-semibold hover:underline" style={{ color: '#1565C0' }}>
                      Iniciar sesión
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setStep(1); setError('') }}
                    className="mb-4 flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700"
                  >
                    ← Volver
                  </button>

                  <h2 className="mb-1 text-2xl font-bold" style={{ color: '#0D2B5E', fontFamily: "'DM Sans', sans-serif" }}>
                    {isAuthenticated ? 'Elegí tu plan' : 'Confirmá la suscripción'}
                  </h2>
                  <p className="mb-6 text-sm text-slate-400">
                    {isAuthenticated
                      ? 'Tu organización fue creada. Elegí el plan y te llevamos a Stripe para completar el pago.'
                      : 'Crearemos la organización y luego te llevaremos a Stripe Checkout con el plan seleccionado.'}
                  </p>

                  {isAuthenticated && orgCreatedId ? (
                    <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      ✓ Organización creada correctamente. Seleccioná el plan para activar tu cuenta.
                    </div>
                  ) : null}

                  {!isAuthenticated ? (
                    <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Plan seleccionado</p>
                      <p className="mt-2 text-lg font-black text-slate-950">
                        {selectedPlan ? `${selectedPlan.name} · ${intervalLabel(selectedPlan.interval)}` : 'No disponible'}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{selectedPlan?.description ?? 'Seleccioná un plan válido.'}</p>
                    </div>
                  ) : null}

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
                    {loading ? 'Procesando…' : 'Continuar a Stripe Checkout'}
                  </button>
                </>
              )}
            </div>

            <div className="rounded-2xl bg-white/95 p-6 shadow-[0_8px_48px_rgba(0,0,0,.25)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Planes disponibles</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Catálogo conectado a Stripe</h3>
              <p className="mt-3 text-sm text-slate-600">
                {isAuthenticated && step === 1
                  ? 'Podés ver los planes antes de crear la organización. Seleccionás el plan en el paso siguiente.'
                  : 'Seleccioná el plan que querés activar durante el onboarding.'}
              </p>

              {plansLoading ? (
                <div className="mt-6 space-y-3">
                  <div className="h-28 animate-pulse rounded-3xl bg-slate-100" />
                  <div className="h-28 animate-pulse rounded-3xl bg-slate-100" />
                </div>
              ) : plans.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  No hay planes Stripe activos en este entorno. Revisá los price IDs en Vercel.
                </div>
              ) : (
                <div className="mt-6 grid gap-3">
                  {plans.map((plan) => {
                    const selected = plan.key === selectedPlanKey
                    // In step 1 for authenticated users, plan cards are informational only.
                    const interactive = !(isAuthenticated && step === 1)
                    return (
                      <button
                        key={plan.key}
                        type="button"
                        onClick={() => interactive && setSelectedPlanKey(plan.key)}
                        disabled={!interactive}
                        className="rounded-[24px] border-2 p-4 text-left transition-all disabled:cursor-default"
                        style={{
                          borderColor: selected ? '#1565C0' : '#E2E8F0',
                          background: selected ? '#EFF6FF' : '#fff',
                          opacity: !interactive ? 0.75 : 1,
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

              {isAuthenticated && step === 1 ? (
                <p className="mt-4 text-xs text-slate-400">
                  El plan se confirma en el paso 2, después de crear la organización.
                </p>
              ) : null}
            </div>
          </div>

          <p className="mt-6 text-center text-xs" style={{ color: 'rgba(255,255,255,.35)' }}>
            LendStack · Sistema de gestión de préstamos
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
