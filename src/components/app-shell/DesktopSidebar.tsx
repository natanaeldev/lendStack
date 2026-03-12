'use client'

import Link from 'next/link'
import { AppNavItem } from './types'

type AdminLink = { href: string; label: string; description: string; icon: string; color: string; hoverBorder: string; hoverBg: string }

export default function DesktopSidebar({
  items,
  activeId,
  collapsed,
  onToggleCollapsed,
  onSelect,
  adminLinks = [],
}: {
  items: AppNavItem[]
  activeId: string
  collapsed: boolean
  onToggleCollapsed: () => void
  onSelect: (id: string) => void
  adminLinks?: AdminLink[]
}) {
  return (
    <aside className={`hidden lg:flex fixed left-0 top-[84px] bottom-0 z-30 border-r border-slate-200 bg-white/95 backdrop-blur flex-col p-3 gap-2 transition-all duration-300 ${collapsed ? 'w-20' : 'w-72'}`}
      style={{ boxShadow: '0 8px 24px rgba(15,23,42,.08)' }}>
      <div className="flex items-center justify-between px-1 py-1">
        {!collapsed && <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Workspace</p>}
        <button
          onClick={onToggleCollapsed}
          className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="space-y-1" aria-label="Navegación principal">
        {items.map(item => {
          const active = activeId === item.id
          return (
            <button
              key={`side-${item.id}`}
              onClick={() => onSelect(item.id)}
              className="w-full text-left rounded-xl transition-all"
              style={{
                background: active ? '#EEF4FF' : 'transparent',
                color: active ? '#0D2B5E' : '#475569',
                border: active ? '1px solid #BFDBFE' : '1px solid transparent',
                padding: collapsed ? '10px' : '12px',
              }}
              title={collapsed ? item.label : undefined}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg leading-none">{item.icon}</span>
                {!collapsed && (
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    {!!item.description && <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>}
                  </div>
                )}
              </div>
            </button>
          )
        })}

        {adminLinks.length > 0 && (
          <>
            <div className="my-2 border-t border-slate-200" />
            {!collapsed && <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Administración</p>}
            {adminLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`w-full text-left rounded-xl transition-all border border-transparent ${link.hoverBorder} ${link.hoverBg}`}
                style={{ color: link.color, padding: collapsed ? '10px' : '12px' }}
                title={collapsed ? link.label : undefined}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg leading-none">{link.icon}</span>
                  {!collapsed && (
                    <div>
                      <p className="text-sm font-semibold">{link.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{link.description}</p>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </>
        )}
      </nav>
    </aside>
  )
}
