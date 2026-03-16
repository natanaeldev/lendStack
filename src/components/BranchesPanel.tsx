'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatCurrency, type Branch, type Currency } from '@/lib/loan'
import ResponsiveDetailSection from '@/components/branches/ResponsiveDetailSection'
import StatusBadge from '@/components/branches/StatusBadge'

type BranchTone = {
  label: string
  icon: string
  accent: string
  accentSoft: string
  accentText: string
  border: string
  surface: string
}

interface BranchDoc {
  id: string
  name: string
  type: Branch
}

interface BranchClient {
  id: string
  name: string
  email: string
  savedAt: string
  branch: Branch | null
  branchId: string | null
  branchName: string | null
  loanStatus?: string
  params: { amount: number; termYears: number; currency: Currency; profile: string; startDate?: string }
  result: { monthlyPayment: number; totalInterest: number; totalMonths?: number }
  payments?: { id: string; date: string; amount: number }[]
}

interface BranchStats {
  totalClients: number
  totalAmount: number
  totalInterest: number
  approvedCount: number
  pendingCount: number
  deniedCount: number
  avgMonthlyPayment: number
  byCurrency: { currency: string; avgMonthlyPayment: number }[]
  recoveryByCurrency: { currency: string; totalAmount: number; totalRecovered: number; percentage: number }[]
  lastActivityAt: string | null
}

const TYPE_CFG: Record<Branch, BranchTone> = {
  sede: {
    label: 'Sucursal',
    icon: '🏢',
    accent: '#1565C0',
    accentSoft: '#DBEAFE',
    accentText: '#0D2B5E',
    border: '#BFDBFE',
    surface: 'linear-gradient(180deg,#F8FBFF 0%,#FFFFFF 100%)',
  },
  rutas: {
    label: 'Ruta',
    icon: '🛣️',
    accent: '#15803D',
    accentSoft: '#DCFCE7',
    accentText: '#14532D',
    border: '#86EFAC',
    surface: 'linear-gradient(180deg,#F7FFF8 0%,#FFFFFF 100%)',
  },
}

const STATUS_CFG: Record<string, { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }> = {
  pending: { label: 'Pendiente', tone: 'warning' },
  approved: { label: 'Aprobado', tone: 'success' },
  denied: { label: 'Denegado', tone: 'danger' },
}

function emptyValue(value?: string | null) {
  if (!value) return '—'
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : '—'
}

function formatCompactMoney(value: number) {
  if (!value) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${Math.round(value).toLocaleString('es-DO')}`
}

function formatDate(value?: string | null) {
  if (!value) return 'No disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No disponible'
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatRelativeDate(value?: string | null) {
  if (!value) return 'No disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No disponible'
  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.max(0, Math.floor(diffMs / 86400000))
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} días`
  return formatDate(value)
}

function initials(name: string) {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return 'CL'
  return parts.map((part) => part[0]).join('').toUpperCase().slice(0, 2)
}

function getLastActivity(client: BranchClient) {
  const paymentDates = (client.payments ?? []).map((payment) => payment.date).filter(Boolean)
  const latestPayment = paymentDates.sort().at(-1)
  return latestPayment ?? client.savedAt ?? null
}

function computeStats(clients: BranchClient[]): BranchStats {
  const totalClients = clients.length
  const totalAmount = clients.reduce((sum, client) => sum + (client.params?.amount ?? 0), 0)
  const totalInterest = clients.reduce((sum, client) => sum + (client.result?.totalInterest ?? 0), 0)
  const approvedCount = clients.filter((client) => client.loanStatus === 'approved').length
  const pendingCount = clients.filter((client) => !client.loanStatus || client.loanStatus === 'pending').length
  const deniedCount = clients.filter((client) => client.loanStatus === 'denied').length

  const currencies = Array.from(new Set(clients.map((client) => client.params?.currency).filter(Boolean))) as Currency[]
  const byCurrency = currencies.map((currency) => {
    const matches = clients.filter((client) => client.params?.currency === currency && (client.result?.monthlyPayment ?? 0) > 0)
    const avgMonthlyPayment = matches.length > 0
      ? matches.reduce((sum, client) => sum + (client.result?.monthlyPayment ?? 0), 0) / matches.length
      : 0
    return { currency, avgMonthlyPayment }
  })

  const monthlyPayments = clients.map((client) => client.result?.monthlyPayment ?? 0).filter((value) => value > 0)
  const avgMonthlyPayment = monthlyPayments.length > 0
    ? monthlyPayments.reduce((sum, value) => sum + value, 0) / monthlyPayments.length
    : 0

  const recoveryByCurrency = currencies.map((currency) => {
    const matches = clients.filter((client) => client.params?.currency === currency)
    const totalAmountByCurrency = matches.reduce((sum, client) => sum + (client.params?.amount ?? 0), 0)
    const totalRecovered = matches.reduce(
      (sum, client) => sum + (client.payments ?? []).reduce((paymentSum, payment) => paymentSum + (payment.amount ?? 0), 0),
      0,
    )
    const percentage = totalAmountByCurrency > 0 ? Math.round((totalRecovered / totalAmountByCurrency) * 100) : 0
    return { currency, totalAmount: totalAmountByCurrency, totalRecovered, percentage }
  })

  const lastActivityAt = clients
    .map((client) => getLastActivity(client))
    .filter(Boolean)
    .sort()
    .at(-1) ?? null

  return {
    totalClients,
    totalAmount,
    totalInterest,
    approvedCount,
    pendingCount,
    deniedCount,
    avgMonthlyPayment,
    byCurrency,
    recoveryByCurrency,
    lastActivityAt,
  }
}

function approvalRate(stats: BranchStats) {
  if (stats.totalClients === 0) return 0
  return Math.round((stats.approvedCount / stats.totalClients) * 100)
}

function topCurrency(stats: BranchStats) {
  return stats.recoveryByCurrency.slice().sort((a, b) => b.totalAmount - a.totalAmount)[0]?.currency ?? '—'
}

function detailSummary(branch: BranchDoc, stats: BranchStats) {
  if (branch.type === 'sede') {
    if (stats.totalClients === 0) return 'Sucursal sin cartera asignada por el momento.'
    return `${stats.totalClients} clientes en cartera, ${approvalRate(stats)}% de aprobación y actividad más reciente ${formatRelativeDate(stats.lastActivityAt).toLowerCase()}.`
  }
  if (stats.totalClients === 0) return 'Ruta sin clientes asignados todavía.'
  return `${stats.totalClients} clientes asignados, cuota promedio ${formatCompactMoney(stats.avgMonthlyPayment)} y actividad más reciente ${formatRelativeDate(stats.lastActivityAt).toLowerCase()}.`
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-900">{value}</p>
    </div>
  )
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="min-w-0 rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,.05)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 break-words text-2xl font-black leading-tight text-slate-950">{value}</p>
      {helper ? <p className="mt-1 break-words text-xs leading-5 text-slate-500">{helper}</p> : null}
    </div>
  )
}

function RecoveryMeter({ currency, recovered, total, percentage }: { currency: string; recovered: number; total: number; percentage: number }) {
  const barColor = percentage >= 70 ? 'linear-gradient(90deg,#16A34A,#22C55E)' : percentage >= 40 ? 'linear-gradient(90deg,#D97706,#F59E0B)' : 'linear-gradient(90deg,#1565C0,#3B82F6)'
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-950">{currency}</p>
          <p className="break-words text-xs text-slate-500">{formatCompactMoney(recovered)} recuperado de {formatCompactMoney(total)}</p>
        </div>
        <span className="text-sm font-black text-slate-900">{percentage}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full" style={{ width: `${Math.min(percentage, 100)}%`, background: barColor }} />
      </div>
    </div>
  )
}

function BranchCard({ branch, clients, onClick }: { branch: BranchDoc; clients: BranchClient[]; onClick: () => void }) {
  const tone = TYPE_CFG[branch.type]
  const stats = useMemo(() => computeStats(clients), [clients])
  const statusValue = stats.totalClients === 0 ? 'Sin asignación' : branch.type === 'sede' ? 'Operativa' : 'En ruta'
  const primaryMetric = branch.type === 'sede' ? `${stats.totalClients} clientes` : `${stats.totalClients} clientes asignados`
  const secondaryMetric = branch.type === 'sede' ? `${approvalRate(stats)}% aprobación` : `${formatCompactMoney(stats.avgMonthlyPayment)} cuota prom.`

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full min-w-0 overflow-hidden rounded-[28px] border border-slate-200 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(15,23,42,.1)] active:scale-[0.99]"
      style={{ background: tone.surface }}
    >
      <div className="border-b border-slate-200/80 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: tone.accentSoft }}>{tone.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 break-words text-base font-black leading-tight text-slate-950">{branch.name}</p>
              <StatusBadge label={tone.label} tone="info" />
            </div>
            <p className="mt-2 break-words text-sm leading-6 text-slate-600">{detailSummary(branch, stats)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4 sm:px-5">
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label={branch.type === 'sede' ? 'Estado' : 'Operación'} value={statusValue} />
          <InfoRow label={branch.type === 'sede' ? 'Actividad' : 'Última gestión'} value={formatRelativeDate(stats.lastActivityAt)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow label={branch.type === 'sede' ? 'Cartera' : 'Principal moneda'} value={branch.type === 'sede' ? formatCompactMoney(stats.totalAmount) : topCurrency(stats)} />
          <InfoRow label={branch.type === 'sede' ? 'Resumen operativo' : 'Cobranza promedio'} value={branch.type === 'sede' ? secondaryMetric : secondaryMetric} />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 sm:px-5">
        <p className="break-words text-xs font-semibold text-slate-500">{primaryMetric}</p>
        <span className="text-sm font-bold" style={{ color: tone.accentText }}>Ver detalles ›</span>
      </div>
    </button>
  )
}

function ClientRow({ client, onViewProfile }: { client: BranchClient; onViewProfile?: (id: string) => void }) {
  const status = STATUS_CFG[client.loanStatus ?? 'pending'] ?? STATUS_CFG.pending
  const currency = client.params?.currency ?? 'USD'

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,.04)] sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-start gap-3 sm:flex-1">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1565C0,#0D2B5E)] text-xs font-black text-white">
          {initials(client.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-bold text-slate-950">{emptyValue(client.name)}</p>
          <p className="mt-1 break-words text-xs leading-5 text-slate-500">{emptyValue(client.email)}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{formatCurrency(client.params?.amount ?? 0, currency)}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{client.params?.termYears ?? '—'} años</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{formatCurrency(client.result?.monthlyPayment ?? 0, currency)}/mes</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <StatusBadge label={status.label} tone={status.tone} />
        {onViewProfile ? (
          <button
            type="button"
            onClick={() => onViewProfile(client.id)}
            className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Ver
          </button>
        ) : null}
      </div>
    </div>
  )
}

function BranchDetail({
  branch,
  clients,
  allRoutes,
  onBack,
  onViewProfile,
}: {
  branch: BranchDoc
  clients: BranchClient[]
  allRoutes: BranchDoc[]
  onBack: () => void
  onViewProfile?: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const tone = TYPE_CFG[branch.type]
  const stats = useMemo(() => computeStats(clients), [clients])

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return clients
    return clients.filter((client) => client.name.toLowerCase().includes(query) || client.email?.toLowerCase().includes(query))
  }, [clients, search])

  const generalRows = branch.type === 'sede'
    ? [
        { label: 'Sucursal', value: branch.name },
        { label: 'Estado', value: stats.totalClients > 0 ? 'Operativa' : 'Sin asignación' },
        { label: 'Dirección', value: 'No disponible' },
        { label: 'Teléfono', value: 'No disponible' },
        { label: 'Encargado', value: 'No disponible' },
        { label: 'Última actividad', value: formatRelativeDate(stats.lastActivityAt) },
      ]
    : [
        { label: 'Ruta', value: branch.name },
        { label: 'Estado', value: stats.totalClients > 0 ? 'En ruta' : 'Sin asignación' },
        { label: 'Sucursal asociada', value: 'No disponible' },
        { label: 'Responsable', value: 'No disponible' },
        { label: 'Próxima visita', value: 'No disponible' },
        { label: 'Última gestión', value: formatRelativeDate(stats.lastActivityAt) },
      ]

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#071A3E_0%,#0D2B5E_58%,#1565C0_100%)] text-white shadow-[0_24px_60px_rgba(7,26,62,.24)]">
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={onBack} className="min-h-11 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/15">
              ← Volver
            </button>
            <StatusBadge label={tone.label} tone="inverse" />
          </div>
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">{branch.type === 'sede' ? 'Sucursal' : 'Ruta'}</p>
              <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:text-3xl">{branch.name}</h1>
              <p className="mt-3 break-words text-sm leading-6 text-blue-100 sm:text-base">{detailSummary(branch, stats)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[360px]">
              <MetricCard label="Clientes" value={String(stats.totalClients)} helper={branch.type === 'sede' ? 'Cartera asignada' : 'Asignados a la ruta'} />
              <MetricCard label="Cartera" value={formatCompactMoney(stats.totalAmount)} helper={topCurrency(stats)} />
              <MetricCard label="Aprobación" value={`${approvalRate(stats)}%`} helper={`${stats.approvedCount} aprobados`} />
              <MetricCard label={branch.type === 'sede' ? 'Cuota prom.' : 'Cobranza prom.'} value={formatCompactMoney(stats.avgMonthlyPayment)} helper={formatRelativeDate(stats.lastActivityAt)} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <div className="min-w-0 space-y-5">
          <ResponsiveDetailSection
            eyebrow="Información general"
            title={branch.type === 'sede' ? 'Datos operativos de la sucursal' : 'Datos operativos de la ruta'}
            description="La información disponible se organiza primero para consulta rápida en campo y luego para revisión de cartera."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {generalRows.map((row) => (
                <InfoRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </ResponsiveDetailSection>

          <ResponsiveDetailSection
            eyebrow={branch.type === 'sede' ? 'Resumen operativo' : 'KPIs de ruta'}
            title={branch.type === 'sede' ? 'Métricas clave de cartera' : 'Métricas clave de gestión'}
            description={branch.type === 'sede' ? 'Lectura rápida de cartera, aprobación y recuperación para supervisión.' : 'Lectura rápida de productividad, cartera y recuperación para operación en calle.'}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Clientes" value={String(stats.totalClients)} helper={`${stats.pendingCount} pendientes`} />
              <MetricCard label="Monto total" value={formatCompactMoney(stats.totalAmount)} helper={stats.deniedCount > 0 ? `${stats.deniedCount} denegados` : 'Sin denegados'} />
              <MetricCard label="Interés total" value={formatCompactMoney(stats.totalInterest)} helper={stats.approvedCount > 0 ? `${stats.approvedCount} aprobados` : 'Sin aprobados'} />
              <MetricCard label="Actividad" value={formatRelativeDate(stats.lastActivityAt)} helper={formatDate(stats.lastActivityAt)} />
            </div>
          </ResponsiveDetailSection>

          {branch.type === 'sede' ? (
            <ResponsiveDetailSection
              eyebrow="Rutas"
              title="Cobertura operativa disponible"
              description="No existe una relación explícita sucursal-ruta en los datos actuales, por lo que se listan las rutas registradas para referencia operativa."
            >
              {allRoutes.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {allRoutes.map((route) => (
                    <div key={route.id} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,.04)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-slate-950">{route.name}</p>
                          <p className="mt-1 text-xs text-slate-500">Ruta disponible en la red</p>
                        </div>
                        <StatusBadge label="Ruta" tone="success" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">No hay rutas registradas.</div>
              )}
            </ResponsiveDetailSection>
          ) : null}

          <ResponsiveDetailSection
            eyebrow={branch.type === 'sede' ? 'Clientes y préstamos' : 'Clientes asociados'}
            title={branch.type === 'sede' ? 'Cartera atendida por esta sucursal' : 'Cartera asignada a esta ruta'}
            description="Los resultados se pueden filtrar rápidamente para identificar al cliente correcto sin ruido visual."
            actions={
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 sm:w-64"
              />
            }
          >
            {filteredClients.length > 0 ? (
              <div className="space-y-3">
                {filteredClients.map((client) => (
                  <ClientRow key={client.id} client={client} onViewProfile={onViewProfile} />
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-slate-700">{search ? 'No hay clientes que coincidan con la búsqueda.' : branch.type === 'sede' ? 'Esta sucursal no tiene clientes aún.' : 'Esta ruta no tiene clientes asignados aún.'}</p>
                <p className="mt-2 text-sm text-slate-500">Ajusta el filtro o vuelve más tarde cuando la cartera esté disponible.</p>
              </div>
            )}
          </ResponsiveDetailSection>
        </div>

        <div className="min-w-0 space-y-5">
          <ResponsiveDetailSection
            eyebrow={branch.type === 'sede' ? 'Actividad reciente' : 'Próximas acciones'}
            title={branch.type === 'sede' ? 'Señales operativas rápidas' : 'Seguimiento operativo rápido'}
            description={branch.type === 'sede' ? 'Vista compacta para revisión de supervisión y coordinación diaria.' : 'Vista compacta para priorizar gestión, visitas y cobranza.'}
          >
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="Última actualización" value={formatDate(stats.lastActivityAt)} />
              <InfoRow label={branch.type === 'sede' ? 'Clientes pendientes' : 'Gestiones pendientes'} value={String(stats.pendingCount)} />
              <InfoRow label={branch.type === 'sede' ? 'Clientes aprobados' : 'Cartera recuperada'} value={branch.type === 'sede' ? String(stats.approvedCount) : `${stats.recoveryByCurrency.reduce((sum, item) => sum + item.percentage, 0) / (stats.recoveryByCurrency.length || 1) || 0}%`} />
            </div>
          </ResponsiveDetailSection>

          <ResponsiveDetailSection
            eyebrow="Recuperación"
            title={branch.type === 'sede' ? 'Estado de recuperación por moneda' : 'Cobranza por moneda'}
            description="Seguimiento simple y visible del capital recuperado frente a la cartera otorgada."
          >
            {stats.recoveryByCurrency.length > 0 ? (
              <div className="space-y-3">
                {stats.recoveryByCurrency.map((item) => (
                  <RecoveryMeter key={item.currency} currency={item.currency} recovered={item.totalRecovered} total={item.totalAmount} percentage={item.percentage} />
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">No disponible</div>
            )}
          </ResponsiveDetailSection>

          <ResponsiveDetailSection
            eyebrow="Resumen"
            title={branch.type === 'sede' ? 'Lectura ejecutiva' : 'Lectura operativa'}
            description="Texto de apoyo para contexto rápido en la revisión diaria."
          >
            <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-600">
              {detailSummary(branch, stats)}
            </div>
          </ResponsiveDetailSection>
        </div>
      </div>
    </div>
  )
}

interface BranchesPanelProps {
  onViewProfile?: (id: string) => void
}

export default function BranchesPanel({ onViewProfile }: BranchesPanelProps) {
  const [branches, setBranches] = useState<BranchDoc[]>([])
  const [clients, setClients] = useState<BranchClient[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/branches').then((response) => (response.ok ? response.json() : { branches: [] })),
      fetch('/api/clients').then((response) => response.json()),
    ])
      .then(([branchResponse, clientResponse]) => {
        setBranches(branchResponse.branches ?? [])
        setClients(clientResponse.clients ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  const sucursales = useMemo(() => branches.filter((branch) => branch.type === 'sede'), [branches])
  const rutas = useMemo(() => branches.filter((branch) => branch.type === 'rutas'), [branches])
  const unassigned = useMemo(() => clients.filter((client) => !client.branchId), [clients])

  const clientsForBranch = (branchId: string) => clients.filter((client) => client.branchId === branchId)
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId)

  if (selectedBranch) {
    return (
      <BranchDetail
        branch={selectedBranch}
        clients={clientsForBranch(selectedBranch.id)}
        allRoutes={rutas}
        onBack={() => setSelectedBranchId(null)}
        onViewProfile={onViewProfile}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center text-slate-400">
          <p className="text-5xl">🏢</p>
          <p className="mt-3 text-sm">Cargando sucursales y rutas...</p>
        </div>
      </div>
    )
  }

  if (branches.length === 0) {
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,.06)] sm:p-12">
        <p className="text-5xl">🏢</p>
        <h2 className="mt-4 text-2xl font-black text-slate-950">No hay sucursales aún</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">Crea la primera sucursal o ruta desde el panel de administración para comenzar a organizar la operación.</p>
        <a
          href="/admin/branches"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0D2B5E,#1565C0)] px-5 text-sm font-bold text-white shadow-[0_18px_34px_rgba(21,101,192,.24)]"
        >
          Gestionar sucursales
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#071A3E_0%,#0D2B5E_54%,#1565C0_100%)] p-4 text-white shadow-[0_24px_60px_rgba(7,26,62,.22)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">Operación territorial</p>
            <h1 className="mt-2 text-balance break-words text-2xl font-black leading-tight sm:text-3xl">Sucursales y rutas con lectura operativa clara</h1>
            <p className="mt-3 break-words text-sm leading-6 text-blue-100 sm:text-base">Identifica cobertura, abre detalles rápido y valida la cartera sin ruido ni texto roto.</p>
          </div>
          <a href="/admin/branches" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15">Gestionar</a>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MetricCard label="Sucursales" value={String(sucursales.length)} helper="Oficinas y sedes activas" />
        <MetricCard label="Rutas" value={String(rutas.length)} helper="Cobertura territorial registrada" />
        <MetricCard label="Sin asignación" value={String(unassigned.length)} helper={unassigned.length > 0 ? 'Clientes por organizar' : 'Sin pendientes'} />
      </div>

      <ResponsiveDetailSection
        eyebrow="Sucursales"
        title="Visión por sucursal"
        description="Las tarjetas priorizan lectura rápida para supervisión: estado, actividad, cartera y acceso inmediato al detalle."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {sucursales.map((branch) => (
            <BranchCard key={branch.id} branch={branch} clients={clientsForBranch(branch.id)} onClick={() => setSelectedBranchId(branch.id)} />
          ))}
        </div>
      </ResponsiveDetailSection>

      <ResponsiveDetailSection
        eyebrow="Rutas"
        title="Visión por ruta"
        description="Las tarjetas de ruta resaltan cartera, gestión y acceso rápido para uso intensivo en campo."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {rutas.map((branch) => (
            <BranchCard key={branch.id} branch={branch} clients={clientsForBranch(branch.id)} onClick={() => setSelectedBranchId(branch.id)} />
          ))}
        </div>
      </ResponsiveDetailSection>

      {unassigned.length > 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Pendiente</p>
              <p className="mt-1 break-words text-sm font-semibold text-slate-900">{unassigned.length} cliente{unassigned.length !== 1 ? 's' : ''} sin sucursal asignada</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">Puedes actualizarlos desde la sección de clientes para completar la cobertura operativa.</p>
            </div>
            <a href="/app/clientes" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Ir a clientes</a>
          </div>
        </div>
      ) : null}
    </div>
  )
}
