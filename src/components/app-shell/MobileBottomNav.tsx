'use client'

import { AppNavItem } from './types'

export default function MobileBottomNav({
  items,
  activeId,
  onSelect,
}: {
  items: AppNavItem[]
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200 pb-safe"
      style={{ boxShadow: '0 -2px 16px rgba(0,0,0,.08)' }}
      aria-label="Navegación móvil">
      <div className="grid grid-cols-5">
        {items.map(item => {
          const active = activeId === item.id
          return (
            <button key={item.id}
              onClick={() => onSelect(item.id)}
              className="min-h-[64px] flex flex-col items-center justify-center gap-0.5 px-1 transition-all"
              style={{ color: active ? '#1565C0' : '#94a3b8' }}>
              <span className="text-[22px] leading-none">{item.icon}</span>
              <span className="text-[10px] font-bold tracking-wide">{item.mobileLabel}</span>
              {active && <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: '#1565C0' }} />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
