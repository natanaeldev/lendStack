'use client'

import Image from 'next/image'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Plan = 'starter' | 'pro'

const PLAN_DETAILS: Record<
  Plan,
  {
    label: string
    price: string
    priceNote: string
    features: string[]
    badge?: string
  }
> = {
  starter: {
    label: 'Starter',
    price: 'Gratis',
    priceNote: 'Siempre',
    features: [
      'Hasta 50 clientes',
      '3 usuarios (master + 2)',
      'Recordatorios automáticos',
      'Dashboard básico',
    ],
  },
  pro: {
    label: 'Pro',
    price: 'USD 29',
    priceNote: 'por mes',
    features: [
      'Clientes ilimitados',
      'Usuarios ilimitados',
      'Recordatorios automáticos',
      'Dashboard avanzado',
      'Soporte prioritario',
    ],
    badge: 'Recomendado',
  },
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [orgName, setOrgName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [plan, setPlan] = useState<Plan>('starter')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleNext = (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!orgName.trim()) {
      setError('Ingresá el nombre de tu organización.')
      return
    }
    if (!adminEmail.trim()) {
      setError('El email es obligatorio.')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setStep(2)
  }

  const handleSubmit = async () => {
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName, adminName, adminEmail, password, plan }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Error al registrar.')
        setStep(1)
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
      setStep(1)
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

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-lg">
          <div className="flex justify-center mb-8">
            <div
              className="rounded-2xl flex-shrink-0"
              style={{ background: 'rgba(255,255,255,.95)', padding: '10px 20px', boxShadow: '0 4px 32px rgba(0,0,0,.3)' }}
            >
              <Image
                src="/logo.png"
                alt="LendStack"
                width={140}
                height={48}
                style={{ objectFit: 'contain', display: 'block' }}
                priority
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 mb-6">
            {[1, 2].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: step >= stepNumber ? '#1565C0' : 'rgba(255,255,255,.2)',
                    color: step >= stepNumber ? '#fff' : 'rgba(255,255,255,.5)',
                  }}
                >
                  {stepNumber}
                </div>
                {stepNumber < 2 && (
                  <div
                    className="w-12 h-0.5 rounded"
                    style={{ background: step > stepNumber ? '#1565C0' : 'rgba(255,255,255,.2)' }}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-8" style={{ boxShadow: '0 8px 48px rgba(0,0,0,.35)' }}>
            {step === 1 && (
              <>
                <h2
                  className="text-2xl font-bold mb-1"
                  style={{ color: '#0D2B5E', fontFamily: "'DM Sans', sans-serif" }}
                >
                  Crear organización
                </h2>
                <p className="text-sm text-slate-400 mb-6">
                  Registrá tu empresa en LendStack. El workspace queda listo para probar préstamos desde el primer ingreso.
                </p>

                <form onSubmit={handleNext} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Nombre de la organización *
                    </label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(event) => setOrgName(event.target.value)}
                      placeholder="Ej: Créditos Rápidos SRL"
                      autoComplete="organization"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      style={{ color: '#374151' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Tu nombre
                    </label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={(event) => setAdminName(event.target.value)}
                      placeholder="Ej: María García"
                      autoComplete="name"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      style={{ color: '#374151' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(event) => setAdminEmail(event.target.value)}
                      placeholder="admin@tuempresa.com"
                      required
                      autoComplete="email"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      style={{ color: '#374151' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Contraseña * <span className="font-normal normal-case text-slate-400">(mín. 8 caracteres)</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      style={{ color: '#374151' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Confirmar contraseña *
                    </label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className={`w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none transition-colors ${
                        confirm && confirm !== password ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
                      }`}
                      style={{ color: '#374151' }}
                    />
                    {confirm && confirm !== password && (
                      <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden.</p>
                    )}
                  </div>

                  {error && (
                    <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!orgName || !adminEmail || !password || !confirm || password !== confirm}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 mt-2"
                    style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}
                  >
                    Siguiente: elegir plan
                  </button>
                </form>

                <p className="text-center text-xs text-slate-400 mt-5">
                  ¿Ya tenés cuenta?{' '}
                  <Link href="/login" className="font-semibold hover:underline" style={{ color: '#1565C0' }}>
                    Iniciar sesión
                  </Link>
                </p>
              </>
            )}

            {step === 2 && (
              <>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-700 mb-4 flex items-center gap-1"
                >
                  Volver
                </button>

                <h2
                  className="text-2xl font-bold mb-1"
                  style={{ color: '#0D2B5E', fontFamily: "'DM Sans', sans-serif" }}
                >
                  Elegí tu plan
                </h2>
                <p className="text-sm text-slate-400 mb-6">
                  Podés empezar gratis y entrar directamente al dashboard para validar el producto.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-6">
                  {(Object.keys(PLAN_DETAILS) as Plan[]).map((planKey) => {
                    const details = PLAN_DETAILS[planKey]
                    const selected = plan === planKey

                    return (
                      <button
                        key={planKey}
                        type="button"
                        onClick={() => setPlan(planKey)}
                        className="text-left rounded-xl border-2 p-4 transition-all"
                        style={{
                          borderColor: selected ? '#1565C0' : '#E2E8F0',
                          background: selected ? '#EFF6FF' : '#fff',
                        }}
                      >
                        {details.badge && (
                          <span
                            className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2"
                            style={{ background: '#1565C0', color: '#fff' }}
                          >
                            {details.badge}
                          </span>
                        )}
                        <div className="flex items-end gap-1 mb-3">
                          <span className="text-xl font-black" style={{ color: '#0D2B5E' }}>
                            {details.price}
                          </span>
                          <span className="text-xs text-slate-400 pb-0.5">{details.priceNote}</span>
                        </div>
                        <p className="text-sm font-bold mb-2" style={{ color: '#0D2B5E' }}>
                          {details.label}
                        </p>
                        <ul className="space-y-1">
                          {details.features.map((feature) => (
                            <li key={feature} className="text-xs text-slate-600 flex items-start gap-1.5">
                              <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </button>
                    )
                  })}
                </div>

                {successMsg && (
                  <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700 mb-4">
                    {successMsg}
                  </div>
                )}
                {error && (
                  <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 mb-4">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}
                >
                  {loading ? 'Creando cuenta...' : plan === 'pro' ? 'Continuar al pago' : 'Crear cuenta gratis'}
                </button>

                <p className="text-center text-xs text-slate-400 mt-4">
                  Al registrarte aceptás los{' '}
                  <span className="underline cursor-pointer" style={{ color: '#1565C0' }}>
                    Términos de uso
                  </span>{' '}
                  y la{' '}
                  <span className="underline cursor-pointer" style={{ color: '#1565C0' }}>
                    Política de privacidad
                  </span>
                  .
                </p>
              </>
            )}
          </div>

          <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,.35)' }}>
            LendStack · Sistema de gestión de préstamos
          </p>
        </div>
      </div>
    </div>
  )
}
