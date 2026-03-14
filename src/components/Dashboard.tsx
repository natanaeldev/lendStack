'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Currency, formatCurrency } from '@/lib/loan'
import DashboardHeader from './dashboard/DashboardHeader'
import DashboardKpiGrid, { type DashboardKpiItem } from './dashboard/DashboardKpiGrid'
import DashboardSkeleton from './dashboard/DashboardSkeleton'
import DashboardEmptyState from './dashboard/DashboardEmptyState'
import PerformanceSnapshotCard from './dashboard/PerformanceSnapshotCard'
import QuickActionsPanel, { type QuickActionItem } from './dashboard/QuickActionsPanel'
import RecentActivityCard from './dashboard/RecentActivityCard'
import ResponsiveDashboardSection from './dashboard/ResponsiveDashboardSection'
import UrgentItemsPanel from './dashboard/UrgentItemsPanel'
import QuickPaymentModal from './QuickPaymentModal'
import { AlertIcon, CalendarIcon, CollectionIcon, LoanIcon, PaymentIcon, PortfolioIcon, SearchIcon, TrendIcon, UserPlusIcon } from './dashboard/DashboardIcons'
import { buildRecentActivity, buildUrgentItems, formatDashboardDate } from './dashboard/helpers'
import type { ClientRow, OrgInfo, StatsData } from './dashboard/types'

function SetupScreen() {
  return (
    <DashboardEmptyState
      title="Conecta la base operativa"
      description="Configura MongoDB Atlas y las variables de entorno para habilitar el centro de operaciones de Inicio. Cuando la conexión esté lista, aquí vas a ver cartera, cobranza y alertas en tiempo real."
    />
  )
}

function statusTone(value: number, warningAt: number, dangerAt: number): 'brand' | 'warning' | 'danger' | 'success' {
  if (value >= dangerAt) return 'danger'
  if (value >= warningAt) return 'warning'
  return value > 0 ? 'brand' : 'success'
}

interface DashboardProps {
  onViewProfile?: (id: string) => void
}

export default function Dashboard({ onViewProfile }: DashboardProps = {}) {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notConfigured, setNotConfigured] = useState(false)
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null)
  const [dashboardCurrency, setDashboardCurrency] = useState<Currency>('USD')
  const [search, setSearch] = useState('')
  const [quickPayClientId, setQuickPayClientId] = useState<string | null>(null)

  const urgentRef = useRef<HTMLDivElement | null>(null)
  const clientRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then((response) => response.json()),
      fetch('/api/clients').then((response) => response.json()),
      fetch('/api/org').then((response) => response.json()).catch(() => null),
    ])
      .then(([statsResponse, clientsResponse, orgResponse]) => {
        if (!statsResponse.configured) {
          setNotConfigured(true)
          return
        }
        setStats(statsResponse)
        setClients(clientsResponse.clients ?? [])
        if (orgResponse && !orgResponse.error) setOrgInfo(orgResponse)
      })
      .catch(() => setNotConfigured(true))
      .finally(() => setLoading(false))
  }, [])

  const goTo = useCallback((path: string) => {
    window.history.pushState(null, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  const goToNewLoan = useCallback(() => {
    window.dispatchEvent(new Event('lendstack:new-loan'))
  }, [])

  const usdToSelected = useCallback((amountUsd: number) => {
    if (dashboardCurrency === 'USD') return amountUsd
    const rate = stats?.exchangeRatesPerUsd?.[dashboardCurrency] ?? 1
    return amountUsd * rate
  }, [dashboardCurrency, stats?.exchangeRatesPerUsd])

  const fmtK = useCallback((amountUsd: number) => {
    const amount = usdToSelected(amountUsd)
    const symbol = dashboardCurrency === 'DOP' ? 'RD$' : '$'
    if (amount >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(2)}M`
    if (amount >= 1_000) return `${symbol}${(amount / 1_000).toFixed(0)}K`
    return `${symbol}${Math.round(amount).toLocaleString('es-AR')}`
  }, [dashboardCurrency, usdToSelected])

  const fmtMoney = useCallback((amount: number, currency: Currency = 'USD') => formatCurrency(amount, currency), [])

  const urgentItems = useMemo(() => buildUrgentItems(clients), [clients])
  const urgentCriticalCount = urgentItems.filter((item) => item.status === 'overdue' || item.status === 'due_today').length
  const recentActivity = useMemo(() => buildRecentActivity(clients, stats?.recentClients ?? [], fmtMoney), [clients, fmtMoney, stats?.recentClients])

  const filteredClients = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return clients.slice(0, 6)
    return clients
      .filter((client) => [client.name, client.email, client.phone].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized)))
      .slice(0, 8)
  }, [clients, search])

  const kpis = useMemo<DashboardKpiItem[]>(() => {
    if (!stats) return []
    const portfolio = stats.portfolio
    return [
      {
        label: 'Cartera activa',
        value: fmtK(portfolio?.activePortfolio ?? 0),
        subvalue: portfolio ? `${portfolio.totalActiveCount} préstamos activos` : 'Sin cartera activa',
        tone: 'brand',
        icon: <PortfolioIcon className="h-5 w-5" />,
      },
      {
        label: 'Morosos',
        value: String(portfolio?.delinquentCount ?? 0),
        subvalue: portfolio ? `${fmtK(portfolio.overdueAmountTotal)} vencido` : 'Sin mora registrada',
        tone: statusTone(portfolio?.delinquentCount ?? 0, 1, 3),
        icon: <AlertIcon className="h-5 w-5" />,
      },
      {
        label: 'Cobrado hoy',
        value: fmtK(stats.collectedToday),
        subvalue: `${stats.collectionRate}% de efectividad mensual`,
        tone: stats.collectedToday > 0 ? 'success' : 'neutral',
        icon: <CollectionIcon className="h-5 w-5" />,
      },
      {
        label: 'Pagos pendientes hoy',
        value: String(portfolio?.dueTodayCount ?? 0),
        subvalue: portfolio?.dueTodayAmount ? `${fmtK(portfolio.dueTodayAmount)} por gestionar` : 'Sin vencimientos hoy',
        tone: statusTone(portfolio?.dueTodayCount ?? 0, 1, 3),
        icon: <CalendarIcon className="h-5 w-5" />,
      },
      {
        label: 'Préstamos activos',
        value: String(portfolio?.totalActiveCount ?? 0),
        subvalue: `${stats.totalClients} clientes en la base`,
        tone: 'neutral',
        icon: <LoanIcon className="h-5 w-5" />,
      },
      {
        label: 'Monto vencido',
        value: fmtK(portfolio?.overdueAmountTotal ?? 0),
        subvalue: urgentCriticalCount > 0 ? `${urgentCriticalCount} casos requieren acción hoy` : 'Sin alertas críticas',
        tone: statusTone(portfolio?.overdueAmountTotal ?? 0, 1, 1),
        icon: <TrendIcon className="h-5 w-5" />,
      },
    ]
  }, [fmtK, stats, urgentCriticalCount])

  const quickActions = useMemo<QuickActionItem[]>(() => [
    { label: 'Crear préstamo', description: 'Iniciar una nueva colocación', icon: <LoanIcon className="h-5 w-5" />, tone: 'brand', onClick: goToNewLoan },
    { label: 'Registrar pago', description: 'Ir al centro de pagos', icon: <PaymentIcon className="h-5 w-5" />, tone: 'neutral', onClick: () => goTo('/app/pagos') },
    { label: 'Nuevo cliente', description: 'Abrir expediente de cliente', icon: <UserPlusIcon className="h-5 w-5" />, tone: 'neutral', onClick: () => goTo('/app/clientes') },
    { label: 'Ver morosos', description: 'Revisar alertas y casos urgentes', icon: <AlertIcon className="h-5 w-5" />, tone: 'danger', onClick: () => urgentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    { label: 'Buscar cliente', description: 'Ir directo al panel de búsqueda', icon: <SearchIcon className="h-5 w-5" />, tone: 'neutral', onClick: () => clientRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
  ], [goTo, goToNewLoan])

  const dashboardTitle = orgInfo?.orgName ? `Inicio · ${orgInfo.orgName}` : 'Inicio'
  const context = `${formatDashboardDate()} · ${urgentCriticalCount > 0 ? `${urgentCriticalCount} alertas críticas` : 'Operación estable'} · ${stats?.portfolio?.totalActiveCount ?? 0} préstamos activos`
  const summary = stats
    ? `La vista prioriza cartera activa, mora, cobranza diaria y pagos que requieren seguimiento inmediato. ${stats.portfolio?.dueTodayCount ?? 0} pagos vencen hoy y ${stats.portfolio?.delinquentCount ?? 0} préstamos están en mora.`
    : ''

  if (loading) return <DashboardSkeleton />
  if (notConfigured) return <SetupScreen />
  if (!stats) {
    return (
      <DashboardEmptyState
        title="No se pudo cargar Inicio"
        description="Intenta recargar la vista. Cuando la fuente de datos responda, el tablero operativo volverá a mostrarse automáticamente."
      />
    )
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-5">
      <DashboardHeader
        title={dashboardTitle}
        description="Centro de operaciones para cartera, cobranza y seguimiento diario."
        context={context}
        summary={summary}
        onPrimaryAction={goToNewLoan}
      />

      {orgInfo ? (
        <div className={`rounded-[26px] border px-4 py-4 shadow-[0_18px_36px_rgba(15,23,42,.05)] ${orgInfo.isAtLimit ? 'border-rose-200 bg-rose-50' : orgInfo.isNearLimit ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Plan y capacidad</p>
              <p className="mt-1 break-words text-sm font-black text-slate-950">
                {orgInfo.plan === 'starter' && orgInfo.maxClients !== null
                  ? `${orgInfo.clientCount} de ${orgInfo.maxClients} clientes utilizados en Starter`
                  : `Plan ${orgInfo.plan.charAt(0).toUpperCase() + orgInfo.plan.slice(1)} activo`}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {orgInfo.isAtLimit
                  ? 'El plan alcanzó su límite y requiere actualización para seguir creciendo.'
                  : orgInfo.isNearLimit
                    ? 'La operación está cerca del límite del plan actual.'
                    : 'La capacidad del plan está saludable para la operación actual.'}
              </p>
            </div>
            <div className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
              {orgInfo.plan}
            </div>
          </div>
        </div>
      ) : null}

      <ResponsiveDashboardSection
        eyebrow="Portafolio"
        title="Visión inmediata de cartera y cobranza"
        description="Los indicadores principales están ordenados por urgencia y utilidad operativa para que un agente móvil entienda el estado del día en segundos."
        action={
          <select value={dashboardCurrency} onChange={(event) => setDashboardCurrency(event.target.value as Currency)} className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none">
            <option value="USD">USD ($)</option>
            <option value="DOP">DOP (RD$)</option>
          </select>
        }
      >
        <DashboardKpiGrid items={kpis} />
      </ResponsiveDashboardSection>

      <ResponsiveDashboardSection eyebrow="Acciones" title="Accesos rápidos de operación" description="Atajos pensados para trabajo de campo: originar, cobrar, abrir clientes y saltar a los casos con más riesgo.">
        <QuickActionsPanel actions={quickActions} />
      </ResponsiveDashboardSection>

      <div ref={urgentRef}>
        <ResponsiveDashboardSection eyebrow="Urgente" title="Qué requiere atención ahora" description="Lista priorizada con mora, pagos del día y próximos vencimientos para reducir retrasos y acelerar el seguimiento.">
          <UrgentItemsPanel
            items={urgentItems}
            onOpenClient={(clientId) => onViewProfile?.(clientId)}
            onQuickPay={(clientId) => setQuickPayClientId(clientId)}
          />
        </ResponsiveDashboardSection>
      </div>

      <ResponsiveDashboardSection eyebrow="Rendimiento" title="Snapshot de desempeño del portafolio" description="Lectura rápida de recaudación y composición operativa. En desktop ofrece contexto analítico; en móvil conserva legibilidad y foco.">
        <PerformanceSnapshotCard stats={stats} fmtK={fmtK} />
      </ResponsiveDashboardSection>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <ResponsiveDashboardSection eyebrow="Actividad" title="Actividad reciente" description="Pagos registrados y nuevos clientes incorporados, ordenados por recencia para supervisión rápida.">
          <RecentActivityCard items={recentActivity} onOpenClient={(clientId) => onViewProfile?.(clientId)} />
        </ResponsiveDashboardSection>

        <div ref={clientRef}>
          <ResponsiveDashboardSection eyebrow="Búsqueda" title="Clientes recientes y búsqueda rápida" description="Módulo liviano para abrir expedientes desde Inicio sin cargar una tabla pesada en móvil.">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3.5 focus-within:border-blue-500 focus-within:bg-white">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre, teléfono o email"
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-3">
                {filteredClients.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No hay clientes que coincidan con la búsqueda.
                  </div>
                ) : (
                  filteredClients.map((client) => (
                    <button key={client.id} type="button" onClick={() => onViewProfile?.(client.id)} className="flex w-full items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-blue-200 hover:bg-blue-50">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-black text-slate-950">{client.name}</p>
                        <p className="mt-1 break-words text-xs text-slate-500">{client.phone || client.email || 'Sin contacto disponible'}</p>
                      </div>
                      <span className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">Abrir</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </ResponsiveDashboardSection>
        </div>
      </div>
      </div>

      <QuickPaymentModal isOpen={quickPayClientId !== null} initialClientId={quickPayClientId} onClose={() => setQuickPayClientId(null)} />
    </>
  )
}
