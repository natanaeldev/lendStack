'use client'

import { useState } from 'react'

type MoreItem = {
  title: string
  subtitle: string
  icon: string
  onClick: () => void
  tone?: 'default' | 'danger'
}

function MoreRow({ item }: { item: MoreItem }) {
  const isDanger = item.tone === 'danger'
  return (
    <button
      onClick={item.onClick}
      className="w-full min-h-14 rounded-xl border px-4 py-3 text-left flex items-center gap-3 transition-all"
      style={{
        borderColor: isDanger ? '#FECACA' : '#E2E8F0',
        background: isDanger ? '#FEF2F2' : '#fff',
      }}
    >
      <span className="text-xl">{item.icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: isDanger ? '#B91C1C' : '#0D2B5E' }}>{item.title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
      </div>
      <span className="text-slate-400">›</span>
    </button>
  )
}

export default function MoreScreen({
  isMaster,
  userName,
  userEmail,
  onGoBranches,
  onGoReports,
  onGoNotifications,
  onGoSettings,
  onGoHelp,
  onLogoutEvent,
}: {
  isMaster: boolean
  userName?: string | null
  userEmail?: string | null
  onGoBranches: () => void
  onGoReports: () => void
  onGoNotifications: () => void
  onGoSettings: () => void
  onGoHelp: () => void
  onLogoutEvent: () => void
}) {
  const [view, setView] = useState<'menu' | 'user'>('menu')

  if (view === 'user') {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('menu')} className="text-sm font-semibold text-slate-500">← Volver</button>
        <div className="rounded-2xl border border-slate-200 bg-white p-5" style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
          <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Usuario</p>
          <h2 className="text-lg font-display mt-1" style={{ color: '#0D2B5E' }}>Perfil y sesión</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Nombre</p>
              <p className="text-sm font-semibold text-slate-700">{userName || 'Usuario de LendStack'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Email</p>
              <p className="text-sm font-semibold text-slate-700">{userEmail || '—'}</p>
            </div>
            <button onClick={onGoSettings} className="min-h-12 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">Editar preferencias</button>
            <button onClick={onLogoutEvent} className="min-h-12 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700">Cerrar sesión</button>
          </div>
        </div>
      </div>
    )
  }

  const accountItems: MoreItem[] = [
    {
      title: 'Usuario',
      subtitle: isMaster ? 'Perfil, sesión y administración de usuarios' : 'Perfil, preferencias y sesión',
      icon: '👤',
      onClick: () => setView('user'),
    },
    {
      title: 'Sucursales',
      subtitle: 'Administrá sucursales y cobertura operativa',
      icon: '🏢',
      onClick: onGoBranches,
    },
  ]

  const secondaryItems: MoreItem[] = [
    { title: 'Reportes', subtitle: 'KPIs y exportaciones financieras', icon: '📑', onClick: onGoReports },
    { title: 'Notificaciones', subtitle: 'Recordatorios y alertas de cobranza', icon: '🔔', onClick: onGoNotifications },
    { title: 'Configuración', subtitle: 'Preferencias y ajustes del sistema', icon: '⚙️', onClick: onGoSettings },
    { title: 'Ayuda', subtitle: 'Soporte y documentación', icon: '🆘', onClick: onGoHelp },
    { title: 'Cerrar sesión', subtitle: 'Salir de tu cuenta segura', icon: '🚪', onClick: onLogoutEvent, tone: 'danger' },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5" style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
        <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Más opciones</p>
        <h2 className="text-lg font-display mt-1" style={{ color: '#0D2B5E' }}>Centro de configuración</h2>
        <p className="text-sm text-slate-500 mt-2">Accedé a acciones secundarias, gestión interna y herramientas de soporte.</p>
      </div>

      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Cuenta y operación</p>
        {accountItems.map((item) => <MoreRow key={item.title} item={item} />)}
      </section>

      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Herramientas</p>
        {secondaryItems.map((item) => <MoreRow key={item.title} item={item} />)}
      </section>
    </div>
  )
}
