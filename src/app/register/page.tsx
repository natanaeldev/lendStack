'use client'

import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
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

function intervalLabel(interval: 'month' | 'year') {
  return interval === 'year' ? 'Anual' : 'Mensual'
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [orgName, setOrgName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [plans, setPlans] = useState<AvailablePlan[]>([])
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>('')
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
        if (nextPlans[0]) setSelectedPlanKey(nextPlans[0].key)
      })
      .catch(() => setError('No se pudieron cargar los planes disponibles.'))
      .finally(() => setPlansLoading(false))
  }, [])

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === selectedPlanKey) ?? null,
    [plans, selectedPlanKey],
  )

  const handleNext = (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!orgName.trim()) {
      setError('Ingresa el nombre de tu organizacion.')
      return
    }
    if (!adminEmail.trim()) {
      setError('El email es obligatorio.')
      return
    }
    if (password.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contrasenas no coinciden.')
      return
    }
    if (!selectedPlanKey) {
      setError('Selecciona un plan para continuar.')
      return
    }

    setStep(2)
  }

  const handleSubmit = async () => {
    if (loading || !selectedPlanKey) return
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName, adminName, adminEmail, password, planKey: selectedPlanKey }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Error al registrar.')
        setStep(2)
        return
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }

      if (data.warning) setSuccessMsg(data.warning)
      const login = await signIn('credentials', {
        email: adminEmail.trim().toLowerCase(),
        password,
        redirect: false,
      })

      if (!login?.ok) {
        router.push('/login?registered=1')
        return
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
                    Registra tu empresa y selecciona un plan real de Stripe. El checkout se abrira automaticamente al finalizar.
                  </p>

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
                        Email *
                      </label>
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(event) => setAdminEmail(event.target.value)}
                        placeholder="admin@tuempresa.com"
                        required
                        autoComplete="email"
                        className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none"
                        style={{ color: '#374151' }}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Contrasena *
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

                    {error ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={!orgName || !adminEmail || !password || !confirm || password !== confirm || plansLoading || !selectedPlanKey}
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
                    Vas a crear el workspace y luego iras a Stripe Checkout con el plan seleccionado.
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
                    {loading ? 'Creando cuenta...' : 'Continuar a Stripe Checkout'}
                  </button>
                </>
              )}
            </div>

            <div className="rounded-2xl bg-white/95 p-6 shadow-[0_8px_48px_rgba(0,0,0,.25)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Planes disponibles</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Catalogo conectado a Stripe</h3>
              <p className="mt-3 text-sm text-slate-600">
                Los planes visibles salen del entorno real. Si un price ID no existe en Vercel, el plan no se muestra aqui.
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
