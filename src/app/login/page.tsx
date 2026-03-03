'use client'
import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [needsSetup,setNeedsSetup]= useState(false)

  // Check if master account exists
  useEffect(() => {
    fetch('/api/auth/check-setup')
      .then(r => r.json())
      .then(d => { if (d.needsSetup) setNeedsSetup(true) })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')

    const res = await signIn('credentials', {
      email, password, redirect: false,
    })

    if (res?.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('Email o contraseña incorrectos.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #071a3e 0%, #0D2B5E 55%, #1565C0 100%)' }}>

      {/* Grid overlay */}
      <div className="fixed inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="rounded-2xl flex-shrink-0"
              style={{ background: 'rgba(255,255,255,.95)', padding: '10px 20px', boxShadow: '0 4px 32px rgba(0,0,0,.3)' }}>
              <Image src="/logo.png" alt="JVF Inversiones" width={140} height={48} style={{ objectFit: 'contain', display: 'block' }} priority />
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl p-8" style={{ boxShadow: '0 8px 48px rgba(0,0,0,.35)' }}>
            <h2 className="text-2xl font-bold mb-1" style={{ color: '#0D2B5E', fontFamily: "'DM Sans', sans-serif" }}>
              Iniciar sesión
            </h2>
            <p className="text-sm text-slate-400 mb-6">Accedé a tu cuenta de JVF Inversiones SRL</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Email
                </label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@jvfinversiones.com" required autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  style={{ color: '#374151' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Contraseña
                </label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  style={{ color: '#374151' }}
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                  ⚠️ {error}
                </div>
              )}

              <button type="submit" disabled={loading || !email || !password}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 mt-2"
                style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}>
                {loading ? '⏳ Ingresando...' : '🔐 Ingresar'}
              </button>
            </form>

            {needsSetup && (
              <p className="text-center text-xs text-slate-400 mt-5">
                ¿Primera vez?{' '}
                <Link href="/signup" className="font-semibold hover:underline" style={{ color: '#1565C0' }}>
                  Crear cuenta maestra
                </Link>
              </p>
            )}
          </div>

          <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,.35)' }}>
            JVF Inversiones SRL · Sistema de gestión de préstamos
          </p>
        </div>
      </div>
    </div>
  )
}
