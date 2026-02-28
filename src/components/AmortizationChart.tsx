'use client'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { AmortizationRow, Currency, formatCurrency } from '@/lib/loan'

interface Props { rows: AmortizationRow[]; accentColor: string; currency: Currency }

const CustomTooltip = ({ active, payload, label, currency }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl p-3 text-xs shadow-2xl" style={{ background: '#0D2B5E', border: '1px solid #1565C0', color: '#fff', minWidth: 170 }}>
      <p className="font-bold mb-2" style={{ color: '#9eb8da' }}>Mes {label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold">{formatCurrency(p.value, currency)}</span>
        </p>
      ))}
    </div>
  )
}

export default function AmortizationChart({ rows, accentColor, currency }: Props) {
  const step = Math.max(1, Math.floor(rows.length / 40))
  const data = rows
    .filter((_, i) => i % step === 0 || i === rows.length - 1)
    .map((r) => ({
      month: r.month,
      'Saldo': Math.round(r.closingBalance),
      'Int. acum.': Math.round(r.cumInterest),
      'Principal': Math.round(r.principal),
      'Interés': Math.round(r.interest),
    }))

  const axisStyle = { fontSize: 10, fill: '#94a3b8' }
  const gridColor = '#e2e8f0'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <p className="text-xs font-semibold text-navy-900 mb-3" style={{ color: '#0D2B5E' }}>Evolución del saldo e interés acumulado</p>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="gBal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1565C0" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1565C0" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gInt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={accentColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={accentColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="month" tick={axisStyle} tickLine={false} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={axisStyle} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="Saldo"      stroke="#1565C0"  strokeWidth={2} fill="url(#gBal)" />
              <Area type="monotone" dataKey="Int. acum." stroke={accentColor} strokeWidth={2} fill="url(#gInt)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold mb-3" style={{ color: '#0D2B5E' }}>Composición mensual: Principal vs Interés</p>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 4 }} barSize={6}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="month" tick={axisStyle} tickLine={false} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} tick={axisStyle} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Principal" stackId="a" fill="#1565C0" />
              <Bar dataKey="Interés"   stackId="a" fill={accentColor} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
