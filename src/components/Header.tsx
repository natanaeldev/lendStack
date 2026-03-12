'use client'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import LendStackLogo from './LendStackLogo'

export default function Header() {
  const { data: session } = useSession()
  const isMaster = session?.user?.role === 'master'

  return (
    <header className="relative"
      style={{ background: 'linear-gradient(135deg, #071a3e 0%, #0D2B5E 55%, #1565C0 100%)', boxShadow: '0 4px 32px rgba(7,26,62,.4)' }}>
      <div className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
      <div className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{ background: 'linear-gradient(90deg, transparent, #1565C0, #B0BEC5, #1565C0, transparent)' }} />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">

        <div className="flex items-center gap-2.5">
          {/* Mobile / tablet drawer trigger */}
          {session?.user && (
            <button
              onClick={() => window.dispatchEvent(new Event('lendstack:toggle-nav-drawer'))}
              className="lg:hidden flex flex-col justify-center items-center w-9 h-9 rounded-xl gap-1.5 transition-all"
              style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.24)' }}
              aria-label="Abrir navegación"
            >
              <span className="block w-5 h-0.5 rounded-full" style={{ background: '#fff' }} />
              <span className="block w-5 h-0.5 rounded-full" style={{ background: '#fff' }} />
              <span className="block w-5 h-0.5 rounded-full" style={{ background: '#fff' }} />
            </button>
          )}

          {/* Logo — also dispatches event so the app shell can reset to dashboard tab */}
          <Link href="/app" className="flex items-center"
            onClick={() => window.dispatchEvent(new Event('lendstack:goto-dashboard'))}>
            <LendStackLogo variant="light" size={36} />
          </Link>
        </div>

        {/* ── Desktop right side (sm+) ── */}
        <div className="hidden sm:flex flex-col items-end gap-1.5">
          {session?.user ? (
            <>
              <div className="flex items-center gap-2">
                {/* ── New loan CTA ── */}
                <button
                  onClick={() => window.dispatchEvent(new Event('lendstack:new-loan'))}
                  className="flex items-center gap-1.5 text-xs font-black px-4 py-1.5 rounded-full transition-all hover:scale-105 active:scale-95"
                  style={{ background: '#fff', color: '#0D2B5E', boxShadow: '0 2px 12px rgba(255,255,255,.25)' }}>
                  + Nuevo préstamo
                </button>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: 'rgba(255,255,255,.12)', color: '#c5d5ea', border: '1px solid rgba(255,255,255,.2)' }}>
                  {isMaster ? '👑' : '👤'} {session.user.name || session.user.email}
                </span>
                {isMaster && (
                  <>
                    <Link href="/admin/users"
                      className="text-xs px-3 py-1 rounded-full font-semibold transition-all hover:opacity-80"
                      style={{ background: 'rgba(249,168,37,.2)', color: '#F9A825', border: '1px solid rgba(249,168,37,.35)' }}>
                      👥 Usuarios
                    </Link>
                    <Link href="/admin/branches"
                      className="text-xs px-3 py-1 rounded-full font-semibold transition-all hover:opacity-80"
                      style={{ background: 'rgba(99,179,237,.15)', color: '#90cdf4', border: '1px solid rgba(99,179,237,.35)' }}>
                      🏢 Sucursales
                    </Link>
                  </>
                )}
                <button onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-xs px-3 py-1 rounded-full font-semibold transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.25)' }}>
                  Cerrar sesión
                </button>
              </div>
              <span className="text-xs" style={{ color: '#6d96c8' }}>v2.0 — Cálculo PMT estándar</span>
            </>
          ) : (
            <>
              <span className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: 'rgba(255,255,255,.12)', color: '#c5d5ea', border: '1px solid rgba(255,255,255,.2)' }}>
                PDF · Multi-préstamo · Clientes · Email · Divisas
              </span>
              <span className="text-xs" style={{ color: '#6d96c8' }}>v2.0 — Cálculo PMT estándar</span>
            </>
          )}
        </div>

        {/* ── Mobile quick action ── */}
        <div className="flex sm:hidden items-center gap-2">
          {session?.user ? (
            <button
              onClick={() => window.dispatchEvent(new Event('lendstack:new-loan'))}
              className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-full transition-all active:scale-95"
              style={{ background: '#fff', color: '#0D2B5E', boxShadow: '0 2px 8px rgba(255,255,255,.2)' }}>
              + Préstamo
            </button>
          ) : (
            <span className="text-xs" style={{ color: '#6d96c8' }}>v2.0</span>
          )}
        </div>

      </div>
    </header>
  )
}
