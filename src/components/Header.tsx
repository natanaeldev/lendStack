'use client'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'

export default function Header() {
  const { data: session } = useSession()

  return (
    <header className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #071a3e 0%, #0D2B5E 55%, #1565C0 100%)', boxShadow: '0 4px 32px rgba(7,26,62,.4)' }}>
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, transparent, #1565C0, #B0BEC5, #1565C0, transparent)' }} />

      <div className="relative max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-5">
        {/* Logo + title */}
        <div className="flex items-center gap-4">
          <div className="rounded-xl flex-shrink-0" style={{ background: 'rgba(255,255,255,.95)', padding: '6px 12px', boxShadow: '0 2px 16px rgba(0,0,0,.25)' }}>
            <Image src="/logo.png" alt="JVF Inversiones" width={130} height={44} style={{ objectFit: 'contain', display: 'block' }} priority />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9eb8da', letterSpacing: '0.18em' }}>Herramientas Financieras Pro</p>
            <h1 className="font-display text-2xl text-white leading-tight">Calculadora de Préstamos</h1>
          </div>
        </div>

        {/* Right side: user info + logout OR feature badge */}
        <div className="hidden md:flex flex-col items-end gap-1.5">
          {session?.user ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: 'rgba(255,255,255,.12)', color: '#c5d5ea', border: '1px solid rgba(255,255,255,.2)' }}>
                  👤 {session.user.name || session.user.email}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-xs px-3 py-1 rounded-full font-semibold transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.25)' }}>
                  Cerrar sesión
                </button>
              </div>
              <span className="text-xs" style={{ color: '#6d96c8' }}>v2.0 — Cálculo PMT estándar</span>
            </>
          ) : (
            <>
              <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: 'rgba(255,255,255,.12)', color: '#c5d5ea', border: '1px solid rgba(255,255,255,.2)' }}>
                PDF · Multi-préstamo · Clientes · Email · Divisas
              </span>
              <span className="text-xs" style={{ color: '#6d96c8' }}>v2.0 — Cálculo PMT estándar</span>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
