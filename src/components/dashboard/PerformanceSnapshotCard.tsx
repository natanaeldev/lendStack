'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { StatsData } from './types'

export default function PerformanceSnapshotCard({ stats, fmtK }: { stats: StatsData; fmtK: (amount: number) => string }) {
  const collectionsData = [
    { label: 'Hoy', amount: stats.collectedToday },
    { label: 'Semana', amount: stats.collectedWeek },
    { label: 'Mes', amount: stats.collectedMonth },
  ]

  const lifecycleData = (stats.portfolio?.byLifecycle ?? [])
    .filter((item) => item.count > 0)
    .slice(0, 5)
    .map((item) => ({
      label: item.status === 'active' ? 'Activos' : item.status === 'delinquent' ? 'Morosos' : item.status === 'paid_off' ? 'Pagados' : item.status === 'pending_approval' ? 'Pendientes' : item.status,
      count: item.count,
    }))

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Cobranza</p>
            <h4 className="mt-1 break-words text-base font-black text-slate-950">Ritmo de recaudación</h4>
          </div>
          <div className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{stats.collectionRate}% de efectividad</div>
        </div>
        <div className="mt-4 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={collectionsData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip formatter={(value: number) => [fmtK(value), 'Cobrado']} contentStyle={{ borderRadius: 14, border: '1px solid #E2E8F0' }} />
              <Bar dataKey="amount" fill="#1565C0" radius={[10, 10, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Estado</p>
        <h4 className="mt-1 break-words text-base font-black text-slate-950">Composición operativa</h4>
        <div className="mt-4 space-y-3">
          {lifecycleData.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Sin datos operativos para mostrar todavía.</div>
          ) : (
            lifecycleData.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="break-words text-sm font-semibold text-slate-700">{item.label}</span>
                  <span className="text-sm font-black text-slate-950">{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-white">
                  <div className="h-full rounded-full" style={{ width: `${Math.max((item.count / Math.max(stats.portfolio?.totalLoansCount ?? 1, 1)) * 100, 10)}%`, background: item.label === 'Morosos' ? 'linear-gradient(90deg,#FB7185,#E11D48)' : 'linear-gradient(90deg,#1565C0,#3B82F6)' }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
