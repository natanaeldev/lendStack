'use client'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import LendStackLogo from './LendStackLogo'

export default function Header() {
  const { data: session } = useSession()
  const isMaster = session?.user?.role === 'master'

  return (
    <header className="sticky top-0 z-50"
      style={{ background: 'linear-gradient(135deg, #071a3e 0%, #0D2B5E 55%, #1565C0 100%)', boxShadow: '0 4px 32px rgba(7,26,62,.34)' }}>
      <div className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
      <div className="relative border-b border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {session?.user && (
              <button
                onClick={() => window.dispatchEvent(new Event('lendstack:toggle-nav-drawer'))}
                className="lg:hidden flex flex-col justify-center items-center w-10 h-10 rounded-xl gap-1.5 transition-all"
                style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.24)' }}
                aria-label="Abrir navegación"
              >
                <span className="block w-5 h-0.5 rounded-full" style={{ background: '#fff' }} />
                <span className="block w-5 h-0.5 rounded-full" style={{ background: '#fff' }} />
                <span className="block w-5 h-0.5 rounded-full" style={{ background: '#fff' }} />
              </button>
            )}

            <Link href="/app" className="flex items-center" onClick={() => window.dispatchEvent(new Event('lendstack:goto-dashboard'))}>
              <LendStackLogo variant="light" size={34} />
            </Link>
          </div>

          {session?.user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => window.dispatchEvent(new Event('lendstack:new-loan'))}
                className="inline-flex min-h-10 items-center gap-1.5 text-xs font-black px-3 sm:px-4 rounded-xl transition-all active:scale-95"
                style={{ background: '#fff', color: '#0D2B5E', boxShadow: '0 2px 12px rgba(255,255,255,.25)' }}>
                + <span className="hidden sm:inline">Nuevo préstamo</span><span className="sm:hidden">Préstamo</span>
              </button>
              <span className="hidden sm:inline-flex text-xs px-2.5 py-2 rounded-xl font-medium"
                style={{ background: 'rgba(255,255,255,.12)', color: '#c5d5ea', border: '1px solid rgba(255,255,255,.2)' }}>
                {isMaster ? '👑' : '👤'} {session.user.name || session.user.email}
              </span>
              <button onClick={() => signOut({ callbackUrl: '/login' })}
                className="min-h-10 text-xs px-3 rounded-xl font-semibold transition-all hover:opacity-80"
                style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.25)' }}>
                Salir
              </button>
            </div>
          ) : (
            <span className="text-xs" style={{ color: '#9ec0e8' }}>v2.0</span>
          )}
        </div>
      </div>
    </header>
  )
}
