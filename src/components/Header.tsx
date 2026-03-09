'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import LendStackLogo from './LendStackLogo'

export default function Header() {
  const { data: session } = useSession()
  const isMaster = session?.user?.role === 'master'

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <header className="relative"
      style={{ background: 'linear-gradient(135deg, #071a3e 0%, #0D2B5E 55%, #1565C0 100%)', boxShadow: '0 4px 32px rgba(7,26,62,.4)' }}>
      <div className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
      <div className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{ background: 'linear-gradient(90deg, transparent, #1565C0, #B0BEC5, #1565C0, transparent)' }} />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">

        {/* Logo — also dispatches event so the app shell can reset to dashboard tab */}
        <Link href="/app" className="flex items-center"
          onClick={() => window.dispatchEvent(new Event('lendstack:goto-dashboard'))}>
          <LendStackLogo variant="light" size={36} />
        </Link>

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

        {/* ── Mobile right side (below sm) ── */}
        <div className="flex sm:hidden items-center gap-2" ref={menuRef}>
          {/* Compact new-loan button always visible on mobile */}
          {session?.user && (
            <button
              onClick={() => window.dispatchEvent(new Event('lendstack:new-loan'))}
              className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-full transition-all active:scale-95"
              style={{ background: '#fff', color: '#0D2B5E', boxShadow: '0 2px 8px rgba(255,255,255,.2)' }}>
              + Préstamo
            </button>
          )}
          {session?.user ? (
            <div className="relative">
              {/* Hamburger button */}
              <button
                onClick={() => setMenuOpen(prev => !prev)}
                className="flex flex-col justify-center items-center w-9 h-9 rounded-xl gap-1.5 transition-all"
                style={{ background: menuOpen ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)' }}
                aria-label="Menú">
                <span className="block w-5 h-0.5 rounded-full transition-all"
                  style={{ background: '#fff', transform: menuOpen ? 'translateY(4px) rotate(45deg)' : 'none' }} />
                <span className="block w-5 h-0.5 rounded-full transition-all"
                  style={{ background: '#fff', opacity: menuOpen ? 0 : 1 }} />
                <span className="block w-5 h-0.5 rounded-full transition-all"
                  style={{ background: '#fff', transform: menuOpen ? 'translateY(-8px) rotate(-45deg)' : 'none' }} />
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div className="absolute right-0 top-11 w-56 rounded-2xl overflow-hidden z-50"
                  style={{ background: '#0D2B5E', border: '1px solid rgba(255,255,255,.15)', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>

                  {/* User info */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,.1)' }}>
                    <p className="text-xs font-bold text-white">{isMaster ? '👑' : '👤'} {session.user.name || session.user.email}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#6d96c8' }}>{isMaster ? 'Administrador' : 'Usuario'}</p>
                  </div>

                  {/* Menu items */}
                  <div className="py-1.5">
                    <button
                      onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event('lendstack:new-loan')) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-black transition-colors hover:bg-white/10"
                      style={{ color: '#fff' }}>
                      ✦ Nuevo préstamo
                    </button>
                    <div className="mx-4 my-1 h-px" style={{ background: 'rgba(255,255,255,.1)' }} />
                    {isMaster && (
                      <>
                        <Link href="/admin/branches" onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10"
                          style={{ color: '#90cdf4' }}>
                          🏢 Sucursales
                        </Link>
                        <Link href="/admin/users" onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10"
                          style={{ color: '#F9A825' }}>
                          👥 Usuarios
                        </Link>
                        <div className="mx-4 my-1 h-px" style={{ background: 'rgba(255,255,255,.1)' }} />
                      </>
                    )}
                    <button onClick={() => { setMenuOpen(false); signOut({ callbackUrl: '/login' }) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10"
                      style={{ color: '#fca5a5' }}>
                      ↪ Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs" style={{ color: '#6d96c8' }}>v2.0</span>
          )}
        </div>

      </div>
    </header>
  )
}
