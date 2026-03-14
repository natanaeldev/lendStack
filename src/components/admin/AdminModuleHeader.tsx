'use client'

import type { ReactNode } from 'react'

type HeaderAction = {
  id: string
  label: string
  href?: string
  onClick?: () => void
  tone?: 'primary' | 'secondary'
}

export default function AdminModuleHeader({
  eyebrow,
  title,
  description,
  stats,
  actions,
  toolbar,
}: {
  eyebrow: string
  title: string
  description: string
  stats?: ReactNode
  actions?: HeaderAction[]
  toolbar?: ReactNode
}) {
  return (
    <header className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(135deg,#071A3E_0%,#0D2B5E_54%,#1565C0_100%)] text-white shadow-[0_18px_48px_rgba(7,26,62,.24)]">
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '38px 38px',
        }}
      />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-100/90">{eyebrow}</p>
            <h1 className="mt-2 text-balance break-words text-[1.85rem] font-black leading-tight text-white sm:text-[2.35rem]">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-blue-100 sm:text-[15px]">{description}</p>
          </div>

          {actions && actions.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[280px] lg:grid-cols-1 xl:grid-cols-2">
              {actions.map((action) => {
                const className =
                  action.tone === 'primary'
                    ? 'border-white bg-white text-slate-950 shadow-[0_16px_32px_rgba(7,26,62,.18)] hover:bg-slate-100'
                    : 'border-white/15 bg-white/10 text-white hover:bg-white/15'

                if (action.href) {
                  return (
                    <a
                      key={action.id}
                      href={action.href}
                      className={`inline-flex min-h-12 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition ${className}`}
                    >
                      {action.label}
                    </a>
                  )
                }

                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.onClick}
                    className={`inline-flex min-h-12 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition ${className}`}
                  >
                    {action.label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        {stats ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{stats}</div> : null}
        {toolbar ? <div className="rounded-[28px] border border-white/10 bg-white/8 p-3 backdrop-blur">{toolbar}</div> : null}
      </div>
    </header>
  )
}
