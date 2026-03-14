'use client'

import RoleBadge from '@/components/admin-users/RoleBadge'
import StatusBadge from '@/components/branches/StatusBadge'

export default function UsuarioSummaryHeader({
  name,
  email,
  role,
  accessLabel,
}: {
  name: string
  email: string
  role: string
  accessLabel: string
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#F8FBFF_0%,#FFFFFF_100%)] p-4 shadow-[0_18px_36px_rgba(15,23,42,.05)]">
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#1565C0,#0D2B5E)] text-sm font-black text-white">
          {(name.trim() || email.trim() || 'US').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-1 break-words text-xl font-black text-slate-950">{name || 'Usuario'}</h2>
            <RoleBadge role={role} />
            <StatusBadge label="Activo" tone="success" />
          </div>
          <p className="mt-2 break-all text-sm text-slate-600">{email || 'No disponible'}</p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Cobertura operativa</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-900">{accessLabel}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
