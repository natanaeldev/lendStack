'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [name,          setName]         = useState('')
  const [email,         setEmail]        = useState('')
  const [password,      setPassword]     = useState('')
  const [confirm,       setConfirm]      = useState('')
  const [error,         setError]        = useState('')
  const [loading,       setLoading]      = useState(false)
  const [alreadyExists, setAlreadyExists]= useState(false)
  const [checking,      setChecking]     = useState(true)

  // Verify no master account exists
  useEffect(() => {
    fetch('/api/auth/check-setup')
      .then(r => r.json())
      .then(d => {
        if (!d.needsSetup) setAlreadyExists(true)
        setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/signup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password }),
    })
    const data = await res.json()

    if (res.ok) {
      router.push('/login?created=1')
    } else {
      setError(data.error ?? 'Error al crear la cuenta.')
    }
    setLoading(false)
  }

  if (checking) return null   // brief flash while checking

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
              <Image src="/logo.png" alt="LendStack" width={140} height={48} style={{ objectFit: 'contain', display: 'block' }} priority />
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl p-8" style={{ boxShadow: '0 8px 48px rgba(0,0,0,.35)' }}>

            {alreadyExists ? (
              /* Account already configured */
              <div className="text-center">
                <p className="text-4xl mb-4">🔒</p>
                <h2 className="text-xl font-bold mb-2" style={{ color: '#0D2B5E' }}>Cuenta ya creada</h2>
                <p className="text-sm text-slate-500 mb-6">
                  La cuenta maestra ya existe. Iniciá sesión para acceder al sistema.
                </p>
                <Link href="/login"
                  className="inline-block px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}>
                  Ir al inicio de sesión
                </Link>
              </div>
            ) : (
              /* Signup form */
              <>
                <h2 className="text-2xl font-bold mb-1" style={{ color: '#0D2B5E', fontFamily: "'DM Sans', sans-serif" }}>
                  Crear cuenta maestra
                </h2>
                <p className="text-sm text-slate-400 mb-6">Configuración inicial de LendStack</p>

                {/* Info banner */}
                <div className="px-4 py-3 rounded-xl mb-5 text-xs"
                  style={{ background: '#E8F5E9', border: '1px solid #2E7D3233', color: '#1B5E20' }}>
                  ℹ️ Se creará <strong>una única cuenta de administrador</strong> para este sistema.
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      Nombre completo
                    </label>
                    <input
                      type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="Ej: Juan V. Fernández" autoComplete="name"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      style={{ color: '#374151' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      Email *
                    </label>
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="admin@lendstack.app" required autoComplete="email"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      style={{ color: '#374151' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      Contraseña * <span className="font-normal normal-case text-slate-400">(mín. 8 caracteres)</span>
                    </label>
                    <input
                      type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" required autoComplete="new-password"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      style={{ color: '#374151' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      Confirmar contraseña *
                    </label>
                    <input
                      type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••" required autoComplete="new-password"
                      className={`w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none transition-colors ${confirm && confirm !== password ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'}`}
                      style={{ color: '#374151' }}
                    />
                    {confirm && confirm !== password && (
                      <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                    )}
                  </div>

                  {error && (
                    <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                      ⚠️ {error}
                    </div>
                  )}

                  <button type="submit"
                    disabled={loading || !email || !password || !confirm || password !== confirm}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 mt-2"
                    style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}>
                    {loading ? '⏳ Creando cuenta...' : '🚀 Crear cuenta maestra'}
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
          </div>

          <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,.35)' }}>
            LendStack · Sistema de gestión de préstamos
          </p>
        </div>
      </div>
    </div>
  )
}
