'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
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

  // loginSuggestionUrl is set when registration fails because the email is already
  // in use. We show an inline link instead of automatically redirecting so that a
  // failed registration never triggers a signIn call.
  const [loginSuggestionUrl, setLoginSuggestionUrl] = useState<string | null>(null)

  // orgCreatedId is set after a successful POST /api/organizations (step 1 for
  // authenticated users). It is passed to POST /api/billing/checkout so the
  // checkout targets the right org even before the JWT has been refreshed.
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

  // ── Resume from saved draft ──────────────────────────────────────────────────
  // This effect waits until the session has fully resolved (sessionLoading = false)
  // before applying the draft, preventing a double-fire that would first set step=2
  // (when isAuthenticated=false during loading) and then reset the UI when the
  // session becomes authenticated.
  //
  // A ref guards against re-application if the dependency array fires again.
  const resumeAppliedRef = useRef(false)
  useEffect(() => {
    if (sessionLoading) return // Wait until session is resolved
    if (resumeAppliedRef.current) return // Only apply once per page load

    const shouldResume = searchParams.get('resume') === '1'
    if (!shouldResume) return

    const draft = readPendingDraft()
    if (!draft) return

    resumeAppliedRef.current = true

    setOrgName(draft.orgName)
    setAdminName((current) => current || draft.adminName)
    setAdminEmail((current) => current || draft.adminEmail)
    setSelectedPlanKey((current) => current || draft.planKey)

    if (isAuthenticated) {
      // Authenticated users land at step 2 (plan selection). The org will be
      // created or recovered automatically when they click "Continuar a Stripe".
      setStep(2)
      setSuccessMsg('Sesión iniciada. Seleccioná el plan para activar tu organización.')
      console.info('[register/resume] authenticated user resumed draft', { orgName: draft.orgName })
    } else {
      // Unauthenticated: jump to plan confirmation step (same as before).
      setStep(2)
    }
  }, [sessionLoading, isAuthenticated, searchParams])

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
  // Authenticated: creates the org via POST /api/organizations, stores orgCreatedId,
  //   then advances to step 2 (plan selection).
  // Unauthenticated: validates and advances to plan confirmation without an API call.
  //   The combined register+checkout call fires on step 2 submit.
  const handleNext = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoginSuggestionUrl(null)

    if (!validateStepOne()) return

    if (isAuthenticated) {
      setLoading(true)
      console.info('[register/handleNext] creating org via /api/organizations', { orgName })
      try {
        const response = await fetch('/api/organizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgName, adminName }),
        })
        const data = await response.json()
        console.info('[register/handleNext] /api/organizations response', {
          status: response.status,
          errorCode: data.errorCode,
          organizationId: data.organizationId,
        })

        if (!response.ok) {
          const code = data.errorCode as string | undefined
          if (code === 'organization_exists') {
            setError('Ya existe una organización con ese nombre. Elegí un nombre diferente.')
          } else if (code === 'membership_exists') {
            setError('Ya pertenecés a una organización activa. Ingresá a tu panel para administrarla.')
          } else if (code === 'email_conflict') {
            setError('Ese email ya está en uso por otra cuenta.')
          } else {
            setError(data.error ?? 'No se pudo crear la organización.')
          }
          return
        }

        console.info('[register/handleNext] org created', { organizationId: data.organizationId })
        setOrgCreatedId(data.organizationId)
        setStep(2)
      } catch {
        setError('No se pudo conectar con el servidor.')
      } finally {
        setLoading(false)
      }
    } else {
      setStep(2)
    }
  }

  // ── Step 2 handler ──────────────────────────────────────────────────────────
  // Authenticated: ensures an orgCreatedId exists (creates/recovers the org on the
  //   fly when the user resumed from draft), then calls POST /api/billing/checkout.
  // Unauthenticated: calls POST /api/register which creates user + org + checkout
  //   atomically. On conflict errors, shows an INLINE error with a login link
  //   instead of automatically redirecting — this is what prevents the
  //   "failed registration → signIn → 401" cascade.
  const handleSubmit = async () => {
    if (loading) return

    setLoading(true)
    setError('')
    setLoginSuggestionUrl(null)

    const pendingDraft: PendingDraft = {
      orgName,
      adminName,
      adminEmail,
      planKey: selectedPlanKey,
    }

    try {
      if (isAuthenticated) {
        // ── Authenticated path ───────────────────────────────────────────────
        if (!selectedPlan) {
          setError('Seleccioná un plan para continuar.')
          return
        }

        // Ensure we have an orgCreatedId.
        // When the user resumed from a draft (came back after logging in), they land
        // directly in step 2 without having gone through step 1 — so orgCreatedId
        // is null. We create/recover the org here before creating the checkout.
        // This is what prevents the fallthrough to /api/register that caused 409s.
        let effectiveOrgId = orgCreatedId
        if (!effectiveOrgId) {
          console.info('[register/handleSubmit] no orgCreatedId — creating/recovering org for resumed user', {
            orgName,
            email: adminEmail,
          })
          const orgResponse = await fetch('/api/organizations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgName, adminName }),
          })
          const orgData = await orgResponse.json()
          console.info('[register/handleSubmit] /api/organizations (on-the-fly) response', {
            status: orgResponse.status,
            errorCode: orgData.errorCode,
            organizationId: orgData.organizationId,
          })

          if (!orgResponse.ok) {
            const code = orgData.errorCode as string | undefined
            if (code === 'organization_exists') {
              setError('Ya existe una organización con ese nombre. Volvé al paso anterior y elegí otro nombre.')
              setStep(1)
            } else if (code === 'membership_exists') {
              setError('Ya pertenecés a una organización activa. Ingresá a tu panel para administrarla.')
            } else {
              setError(orgData.error ?? 'No se pudo crear la organización. Intentalo de nuevo.')
            }
            return
          }

          effectiveOrgId = orgData.organizationId as string
          setOrgCreatedId(effectiveOrgId)
        }

        // Create Stripe checkout for the org
        console.info('[register/handleSubmit] creating checkout', {
          organizationId: effectiveOrgId,
          planKey: selectedPlan.productKey,
          interval: selectedPlan.interval,
        })
        const checkoutResponse = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: effectiveOrgId,
            planKey: selectedPlan.productKey,
            interval: selectedPlan.interval,
          }),
        })
        const checkoutData = await checkoutResponse.json()
        console.info('[register/handleSubmit] /api/billing/checkout response', {
          status: checkoutResponse.status,
          errorCode: checkoutData.errorCode,
          hasUrl: !!checkoutData.url,
        })

        if (!checkoutResponse.ok) {
          if (checkoutData.errorCode === 'invalid_plan') {
            setError('El plan seleccionado no está disponible. Elegí otro plan.')
          } else if (checkoutData.errorCode === 'forbidden') {
            setError('No tenés permisos para gestionar esta organización.')
          } else {
            setError(checkoutData.error ?? 'No se pudo iniciar el checkout.')
          }
          return
        }

        if (checkoutData.url) {
          writePendingDraft(pendingDraft)
          console.info('[register/handleSubmit] redirecting to Stripe checkout')
          window.location.href = checkoutData.url
          return
        }

        setError('No se pudo obtener la URL de Stripe. Intentalo de nuevo.')
        return
      }

      // ── Unauthenticated path ─────────────────────────────────────────────────
      if (!selectedPlanKey) {
        setError('Seleccioná un plan para continuar.')
        return
      }

      console.info('[register/handleSubmit] calling /api/register', { orgName, email: adminEmail })
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
      console.info('[register/handleSubmit] /api/register response', {
        status: response.status,
        errorCode: data.errorCode,
        hasCheckoutUrl: !!data.checkoutUrl,
        requiresLogin: data.requiresLogin,
      })

      if (!response.ok) {
        // ── CRITICAL: show inline errors — do NOT redirect to login ──────────
        // Automatically redirecting to login after a failed registration causes
        // the signIn("credentials") → 401 cascade observed in the network tab.
        // We instead surface the error in-place with a manual login CTA.
        if (
          data.errorCode === 'existing_user_requires_login' ||
          data.errorCode === 'incomplete_onboarding'
        ) {
          writePendingDraft(pendingDraft)
          const loginUrl =
            `/login?next=${encodeURIComponent('/register?resume=1')}&reason=org-create` +
            (adminEmail ? `&email=${encodeURIComponent(adminEmail)}` : '')
          console.warn('[register/handleSubmit] account conflict — showing login suggestion', {
            errorCode: data.errorCode,
            loginUrl,
          })
          setError(data.error ?? 'Ya existe una cuenta con esos datos.')
          setLoginSuggestionUrl(loginUrl)
          return
        }

        setError(data.error ?? 'Error al registrar la organización.')
        // Reset to step 1 for conflicts that require changing org name or email
        if (
          data.errorCode === 'organization_exists' ||
          data.errorCode === 'membership_exists' ||
          data.errorCode === 'email_conflict'
        ) {
          console.warn('[register/handleSubmit] conflict requires step reset', { errorCode: data.errorCode })
          setStep(1)
        }
        return
      }

      // Success
      if (data.checkoutUrl) {
        writePendingDraft(pendingDraft)
        console.info('[register/handleSubmit] redirecting to Stripe checkout (unauthenticated)')
        window.location.href = data.checkoutUrl
        return
      }

      clearPendingDraft()

      if (data.warning) {
        setSuccessMsg(data.warning)
      }

      // Org was created but Stripe isn't configured: redirect to login so the
      // user can access the dashboard directly
      if (data.requiresLogin) {
        console.info('[register/handleSubmit] requiresLogin — redirecting to /login')
        router.push('/login?registered=1')
        return
      }

      // Unauthenticated users who reach this point just registered successfully
      // (Stripe not configured). Send them to login so they can access the app.
      router.push('/login?registered=1')
      router.refresh()
    } catch (err) {
      console.error('[register/handleSubmit] unexpected error', err)
      setError('No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  // The step 1 submit button stays disabled while the session is resolving.
  // This prevents the race condition where the form fires before isAuthenticated
  // is known, routing to the wrong endpoint (/api/register instead of /api/organizations).
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
                        <span>{error}</span>
                        {loginSuggestionUrl ? (
                          <Link
                            href={loginSuggestionUrl}
                            className="ml-1 font-bold underline"
                            style={{ color: '#b91c1c' }}
                          >
                            Iniciá sesión aquí →
                          </Link>
                        ) : null}
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
                    onClick={() => { setStep(1); setError(''); setLoginSuggestionUrl(null) }}
                    className="mb-4 flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700"
                  >
                    ← Volver
                  </button>

                  <h2 className="mb-1 text-2xl font-bold" style={{ color: '#0D2B5E', fontFamily: "'DM Sans', sans-serif" }}>
                    {isAuthenticated ? 'Elegí tu plan' : 'Confirmá la suscripción'}
                  </h2>
                  <p className="mb-6 text-sm text-slate-400">
                    {isAuthenticated
                      ? orgCreatedId
                        ? 'Tu organización fue creada. Elegí el plan y te llevamos a Stripe para completar el pago.'
                        : 'Seleccioná el plan y creamos tu organización antes de ir a Stripe.'
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
                      <span>{error}</span>
                      {loginSuggestionUrl ? (
                        <Link
                          href={loginSuggestionUrl}
                          className="ml-1 font-bold underline"
                          style={{ color: '#b91c1c' }}
                        >
                          Iniciá sesión aquí →
                        </Link>
                      ) : null}
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
                  ? 'Podés ver los planes antes de crear la organización. Los seleccionás en el paso siguiente.'
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
                    // Plan cards are informational (non-interactive) in step 1 for
                    // authenticated users; they become interactive in step 2.
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
