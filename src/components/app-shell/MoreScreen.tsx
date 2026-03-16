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
      className="flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all"
      style={{
        borderColor: isDanger ? '#FECACA' : '#E2E8F0',
        background: isDanger ? '#FEF2F2' : '#FFFFFF',
      }}
    >
      <span className="text-xl">{item.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold" style={{ color: isDanger ? '#B91C1C' : '#0D2B5E' }}>{item.title}</p>
        <p className="mt-0.5 break-words text-xs text-slate-500">{item.subtitle}</p>
      </div>
      <span className="text-slate-400">{'\u203a'}</span>
    </button>
  )
}

export default function MoreScreen({
  isMaster,
  userName,
  userEmail,
  onGoCalculator,
  onGoBranches,
  onGoReports,
  onGoAdmin,
  onGoNotifications,
  onGoSettings,
  onGoHelp,
  onLogoutEvent,
}: {
  isMaster: boolean
  userName?: string | null
  userEmail?: string | null
  onGoCalculator: () => void
  onGoBranches: () => void
  onGoReports: () => void
  onGoAdmin: () => void
  onGoNotifications: () => void
  onGoSettings: () => void
  onGoHelp: () => void
  onLogoutEvent: () => void
}) {
  const [view, setView] = useState<'menu' | 'user'>('menu')

  if (view === 'user') {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('menu')} className="text-sm font-semibold text-slate-500">{'\u2190 Volver'}</button>
        <div className="rounded-2xl border border-slate-200 bg-white p-5" style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Usuario</p>
          <h2 className="mt-1 text-lg font-display" style={{ color: '#0D2B5E' }}>{'Perfil y sesi\u00f3n'}</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Nombre</p>
              <p className="text-sm font-semibold text-slate-700">{userName || 'Usuario de LendStack'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Email</p>
              <p className="text-sm font-semibold text-slate-700">{userEmail || '\u2014'}</p>
            </div>
            <button onClick={onGoSettings} className="min-h-12 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">Editar preferencias</button>
            <button onClick={onLogoutEvent} className="min-h-12 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700">{'Cerrar sesi\u00f3n'}</button>
          </div>
        </div>
      </div>
    )
  }

  const accountItems: MoreItem[] = [
    {
      title: 'Usuario',
      subtitle: isMaster ? 'Perfil, sesi\u00f3n y administraci\u00f3n de usuarios' : 'Perfil, preferencias y sesi\u00f3n',
      icon: '\u{1F464}',
      onClick: () => setView('user'),
    },
    {
      title: 'Calculadora',
      subtitle: 'Simul\u00e1 cuotas y condiciones en segundos',
      icon: '\u{1F9EE}',
      onClick: onGoCalculator,
    },
    {
      title: 'Sucursales',
      subtitle: 'Administr\u00e1 sucursales y cobertura operativa',
      icon: '\u{1F3E2}',
      onClick: onGoBranches,
    },
  ]

  const secondaryItems: MoreItem[] = [
    { title: 'Reportes', subtitle: 'KPIs y exportaciones financieras', icon: '\u{1F4D1}', onClick: onGoReports },
    ...(isMaster ? [{ title: 'Admin', subtitle: 'Usuarios, sucursales y control organizacional', icon: '\u2699\uFE0F', onClick: onGoAdmin }] : []),
    { title: 'Notificaciones', subtitle: 'Recordatorios y alertas de cobranza', icon: '\u{1F514}', onClick: onGoNotifications },
    { title: 'Configuraci\u00f3n', subtitle: 'Preferencias y ajustes del sistema', icon: '\u2699\uFE0F', onClick: onGoSettings },
    { title: 'Ayuda', subtitle: 'Soporte y documentaci\u00f3n', icon: '\u{1F198}', onClick: onGoHelp },
    { title: 'Cerrar sesi\u00f3n', subtitle: 'Salir de tu cuenta segura', icon: '\u{1F6AA}', onClick: onLogoutEvent, tone: 'danger' },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5" style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{'M\u00e1s opciones'}</p>
        <h2 className="mt-1 text-lg font-display" style={{ color: '#0D2B5E' }}>{'Centro de configuraci\u00f3n'}</h2>
        <p className="mt-2 text-sm text-slate-500">{'Acced\u00e9 a acciones secundarias, gesti\u00f3n interna y herramientas de soporte.'}</p>
      </div>

      <section className="space-y-2">
        <p className="px-1 text-xs font-bold uppercase tracking-wider text-slate-400">{'Cuenta y operaci\u00f3n'}</p>
        {accountItems.map((item) => <MoreRow key={item.title} item={item} />)}
      </section>

      <section className="space-y-2">
        <p className="px-1 text-xs font-bold uppercase tracking-wider text-slate-400">Herramientas</p>
        {secondaryItems.map((item) => <MoreRow key={item.title} item={item} />)}
      </section>
    </div>
  )
}
