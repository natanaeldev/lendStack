'use client'

const ROLE_CLASSES = {
  master: 'border-amber-200 bg-amber-50 text-amber-800',
  manager: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  operator: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  user: 'border-blue-200 bg-blue-50 text-blue-800',
} as const

const ROLE_LABELS = {
  master: 'Maestro',
  manager: 'Gerente',
  operator: 'Operador',
  user: 'Usuario',
} as const

export default function RoleBadge({ role }: { role: string }) {
  const safeRole = (role in ROLE_CLASSES ? role : 'user') as keyof typeof ROLE_CLASSES
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.04em] ${ROLE_CLASSES[safeRole]}`}>{ROLE_LABELS[safeRole]}</span>
}
