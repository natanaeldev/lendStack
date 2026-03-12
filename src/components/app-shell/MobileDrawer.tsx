'use client'

import Link from 'next/link'
import { AppNavItem } from './types'

type AdminLink = { href: string; label: string; description: string; icon: string; color: string; hoverBorder: string; hoverBg: string }

export default function MobileDrawer({
  open,
  items,
  activeId,
  onClose,
  onSelect,
  adminLinks = [],
}: {
  open: boolean
  items: AppNavItem[]
  activeId: string
  onClose: () => void
  onSelect: (id: string) => void
  adminLinks?: AdminLink[]
}) {
  return (
    <div className={`lg:hidden fixed inset-0 z-[70] transition-opacity duration-200 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} aria-hidden={!open}>
      <button
        aria-label="Cerrar navegación"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navegación principal"
        className={`absolute left-0 top-0 h-full w-[88%] max-w-[360px] bg-white border-r border-slate-200 shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-5 border-b border-slate-100">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-bold">LendStack</p>
          <h3 className="text-lg font-display" style={{ color: '#0D2B5E' }}>Workspace</h3>
        </div>
        <nav className="p-3 space-y-1" aria-label="Secciones">
          {items.map(item => {
            const active = activeId === item.id
            return (
              <button
                key={`drawer-${item.id}`}
                onClick={() => onSelect(item.id)}
                className="w-full rounded-xl px-3 py-3 text-left transition-all"
                style={{
                  background: active ? '#EEF4FF' : 'transparent',
                  color: active ? '#0D2B5E' : '#475569',
                  border: active ? '1px solid #BFDBFE' : '1px solid transparent',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg leading-none">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    {!!item.description && <p className="text-xs text-slate-400">{item.description}</p>}
                  </div>
                </div>
              </button>
            )
          })}

          {adminLinks.length > 0 && (
            <>
              <div className="my-2 border-t border-slate-200" />
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Administración</p>
              {adminLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className={`w-full rounded-xl px-3 py-3 text-left transition-all border border-transparent ${link.hoverBorder} ${link.hoverBg} flex items-center gap-2.5`}
                  style={{ color: link.color }}
                >
                  <span className="text-lg leading-none">{link.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{link.label}</p>
                    <p className="text-xs text-slate-400">{link.description}</p>
                  </div>
                </Link>
              ))}
            </>
          )}
        </nav>
      </aside>
    </div>
  )
}
