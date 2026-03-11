'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'

interface OrgData {
  orgName?: string
  plan?: 'starter' | 'pro' | 'enterprise'
  clientCount?: number
  maxClients?: number | null
}

interface StatsData {
  totalClients: number
  totalLoans: number
  approvedCount: number
  pendingCount: number
  deniedCount: number
  totalAmount: number
  totalInterest: number
  totalMonthlyIncome: number
  collectedToday: number
  collectedWeek: number
  collectedWeekPrev: number
  collectedMonth: number
  collectedMonthPrev: number
  byBranch: { sede: number; rutas: number }
  byBranchPerformance: {
    sede: { count: number; percentage: number }
    rutas: { count: number; percentage: number }
    topBranch: 'sede' | 'rutas' | 'tie'
  }
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export default function OrganizationReport() {
  const [org, setOrg] = useState<OrgData | null>(null)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [orgRes, statsRes] = await Promise.all([
          fetch('/api/org', { cache: 'no-store' }),
          fetch('/api/stats', { cache: 'no-store' }),
        ])
        if (!orgRes.ok || !statsRes.ok) throw new Error('No fue posible cargar el reporte')

        const orgJson = await orgRes.json()
        const statsJson = await statsRes.json()

        if (!mounted) return
        setOrg(orgJson)
        setStats(statsJson)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Error inesperado')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [])

  const approvedRate = useMemo(() => {
    if (!stats || stats.totalLoans === 0) return 0
    return Math.round((stats.approvedCount / stats.totalLoans) * 100)
  }, [stats])

  const utilization = useMemo(() => {
    if (!org?.maxClients || !org.clientCount) return null
    return Math.round((org.clientCount / org.maxClients) * 100)
  }, [org])

  const weekDelta = useMemo(() => {
    if (!stats) return 0
    if (stats.collectedWeekPrev <= 0) return stats.collectedWeek > 0 ? 100 : 0
    return Math.round(((stats.collectedWeek - stats.collectedWeekPrev) / stats.collectedWeekPrev) * 100)
  }, [stats])

  const monthDelta = useMemo(() => {
    if (!stats) return 0
    if (stats.collectedMonthPrev <= 0) return stats.collectedMonth > 0 ? 100 : 0
    return Math.round(((stats.collectedMonth - stats.collectedMonthPrev) / stats.collectedMonthPrev) * 100)
  }, [stats])

  const topBranchLabel = useMemo(() => {
    if (!stats) return 'N/A'
    if (stats.byBranchPerformance.topBranch === 'tie') return 'Empate'
    return stats.byBranchPerformance.topBranch === 'sede' ? 'Sede' : 'Rutas'
  }, [stats])

  const generatedAt = new Date().toLocaleString('es-DO', {
    dateStyle: 'full',
    timeStyle: 'short',
  })

  const revenueCompareData = useMemo(() => {
    if (!stats) return []
    return [
      { period: 'Semana anterior', amount: stats.collectedWeekPrev },
      { period: 'Semana actual', amount: stats.collectedWeek },
      { period: 'Mes anterior', amount: stats.collectedMonthPrev },
      { period: 'Mes actual', amount: stats.collectedMonth },
    ]
  }, [stats])

  const branchCompareData = useMemo(() => {
    if (!stats) return []
    return [
      {
        branch: 'Sede',
        clients: stats.byBranch.sede,
        percentage: stats.byBranchPerformance.sede.percentage,
      },
      {
        branch: 'Rutas',
        clients: stats.byBranch.rutas,
        percentage: stats.byBranchPerformance.rutas.percentage,
      },
    ]
  }, [stats])

  return (
    <section className="rounded-2xl p-5 sm:p-6 bg-white border border-slate-200" style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Reporte organizacional</p>
          <h2 className="font-display text-2xl sm:text-3xl" style={{ color: '#0D2B5E' }}>
            {org?.orgName || 'Organización'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">Generado: {generatedAt}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#EEF4FF', color: '#1565C0' }}>
            Plan: {(org?.plan || 'starter').toUpperCase()}
          </span>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50">
            🖨️ Imprimir
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Cargando métricas del reporte...</p>}
      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

      {!loading && !error && org && stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Kpi label="Clientes" value={String(stats.totalClients)} />
            <Kpi label="Préstamos" value={String(stats.totalLoans)} />
            <Kpi label="Aprobación" value={`${approvedRate}%`} />
            <Kpi label="Ingreso mensual" value={money.format(stats.totalMonthlyIncome)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Info title="Resumen financiero">
              <Row label="Capital total" value={money.format(stats.totalAmount)} />
              <Row label="Interés proyectado" value={money.format(stats.totalInterest)} />
              <Row label="Cobrado hoy" value={money.format(stats.collectedToday)} />
              <Row label="Cobrado esta semana" value={money.format(stats.collectedWeek)} />
              <Row label="Cobrado este mes" value={money.format(stats.collectedMonth)} />
            </Info>

            <Info title="Comparación de ingresos vs período anterior">
              <div className="sm:hidden grid grid-cols-2 gap-2 mb-3">
                <MiniMetricCard
                  title="Semanal"
                  current={money.format(stats.collectedWeek)}
                  delta={weekDelta}
                />
                <MiniMetricCard
                  title="Mensual"
                  current={money.format(stats.collectedMonth)}
                  delta={monthDelta}
                />
              </div>
              <Row label="Semana anterior" value={money.format(stats.collectedWeekPrev)} />
              <Row label="Variación semanal" value={`${weekDelta > 0 ? '+' : ''}${weekDelta}%`} />
              <Row label="Mes anterior" value={money.format(stats.collectedMonthPrev)} />
              <Row label="Variación mensual" value={`${monthDelta > 0 ? '+' : ''}${monthDelta}%`} />
            </Info>

            <Info title="Rendimiento por sucursal">
              <div className="sm:hidden grid grid-cols-2 gap-2 mb-3">
                <MiniMetricCard
                  title="Sede"
                  current={`${stats.byBranch.sede} (${stats.byBranchPerformance.sede.percentage}%)`}
                  delta={stats.byBranchPerformance.sede.percentage - stats.byBranchPerformance.rutas.percentage}
                />
                <MiniMetricCard
                  title="Rutas"
                  current={`${stats.byBranch.rutas} (${stats.byBranchPerformance.rutas.percentage}%)`}
                  delta={stats.byBranchPerformance.rutas.percentage - stats.byBranchPerformance.sede.percentage}
                />
              </div>
              <Row label="Sede" value={`${stats.byBranch.sede} (${stats.byBranchPerformance.sede.percentage}%)`} />
              <Row label="Rutas" value={`${stats.byBranch.rutas} (${stats.byBranchPerformance.rutas.percentage}%)`} />
              <Row label="Mejor desempeño" value={topBranchLabel} />
            </Info>

            <Info title="Estado de cartera">
              <Row label="Aprobados" value={String(stats.approvedCount)} />
              <Row label="Pendientes" value={String(stats.pendingCount)} />
              <Row label="Denegados" value={String(stats.deniedCount)} />
              <Row label="Uso de cupo" value={utilization !== null ? `${utilization}%` : 'Sin límite'} />
            </Info>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Info title="Gráfico de comparación de ingresos">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueCompareData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: number) => money.format(v)} />
                    <Legend />
                    <Bar dataKey="amount" name="Ingresos" fill="#1565C0" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Info>

            <Info title="Gráfico Sede vs Rutas">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchCompareData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="branch" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 12 }} unit="%" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="clients" name="Clientes" fill="#0D2B5E" radius={[8, 8, 0, 0]} />
                    <Bar yAxisId="right" dataKey="percentage" name="Participación" fill="#2E7D32" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Info>
          </div>
        </>
      )}
    </section>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-display" style={{ color: '#0D2B5E' }}>{value}</p>
    </div>
  )
}

function MiniMetricCard({ title, current, delta }: { title: string; current: string; delta: number }) {
  const positive = delta >= 0

  return (
    <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">{title}</p>
      <p className="text-sm font-bold" style={{ color: '#0D2B5E' }}>{current}</p>
      <p className="text-xs font-semibold mt-1" style={{ color: positive ? '#2E7D32' : '#B91C1C' }}>
        {positive ? '▲' : '▼'} {delta > 0 ? '+' : ''}{delta}%
      </p>
    </div>
  )
}

function Info({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-white">
      <h3 className="text-sm font-bold mb-3" style={{ color: '#0D2B5E' }}>{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-right" style={{ color: '#0D2B5E' }}>{value}</span>
    </div>
  )
}
