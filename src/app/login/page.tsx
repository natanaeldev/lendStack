'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LendStackLogo from '@/components/LendStackLogo'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const requestedNextPath = searchParams.get('next')
  const nextPath = requestedNextPath?.startsWith('/') ? requestedNextPath : '/app'
  const isOrgResume = searchParams.get('reason') === 'org-create'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email || !password || loading) return

    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.ok) {
      router.push(nextPath)
      router.refresh()
    } else {
      setError('Email o contrasena incorrectos.')
    }

    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #071a3e 0%, #0D2B5E 55%, #1565C0 100%)' }}
    >
      <div
        className="fixed inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '38px 38px',
        }}
      />

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-8">
            <LendStackLogo variant="light" size={48} />
          </div>

          <div className="bg-white rounded-2xl p-8" style={{ boxShadow: '0 8px 48px rgba(0,0,0,.35)' }}>
            <h2 className="text-2xl font-bold mb-1" style={{ color: '#0D2B5E', fontFamily: "'DM Sans', sans-serif" }}>
              Iniciar sesion
            </h2>
            <p className="text-sm text-slate-400 mb-6">Accede a tu organizacion en LendStack</p>

            {isOrgResume && (
              <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700 mb-4">
                Inicia sesion con el email owner para continuar la creacion de la organizacion.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@lendstack.app"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  style={{ color: '#374151' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Contrasena</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  style={{ color: '#374151' }}
                />
              </div>

              {error ? (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>
              ) : null}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 mt-2"
                style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-5">
              Primera vez?{' '}
              <Link href="/register" className="font-semibold hover:underline" style={{ color: '#1565C0' }}>
                Crear organizacion
              </Link>
            </p>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,.35)' }}>
            LendStack · Sistema de gestion de prestamos
          </p>
        </div>
      </div>
    </div>
  )
}
