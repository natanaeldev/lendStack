'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/loan'

type PaymentRecord = {
  id: string
  date: string
  amount: number
  cuotaNumber?: number
  notes?: string
}

type ClientPaymentHubRecord = {
  id: string
  name: string
  phone?: string
  email?: string
  branchName?: string | null
  loanStatus?: string
  loanType?: 'amortized' | 'weekly' | 'carrito'
  params?: {
    currency?: string
    startDate?: string
    frequency?: 'daily' | 'weekly'
    numPayments?: number
  } | null
  result?: {
    monthlyPayment?: number
    weeklyPayment?: number
    fixedPayment?: number
    totalMonths?: number | null
    totalWeeks?: number | null
    numPayments?: number | null
  } | null
  payments?: PaymentRecord[]
}

type DueItem = {
  clientId: string
  clientName: string
  branchName?: string | null
  currency: string
  scheduledAmount: number
  nextDueDate: string
  daysFromToday: number
  status: 'overdue' | 'due-soon'
}

type RecentPaymentItem = {
  clientId: string
  clientName: string
  currency: string
  amount: number
  date: string
  notes?: string
}

function toDate(value?: string | null) {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function diffInDays(target: Date, base: Date) {
  const msPerDay = 1000 * 60 * 60 * 24
  const utcTarget = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  const utcBase = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())
  return Math.round((utcTarget - utcBase) / msPerDay)
}

function addPeriods(start: Date, loanType: ClientPaymentHubRecord['loanType'], frequency: 'daily' | 'weekly', periods: number) {
  const next = new Date(start)

  if (loanType === 'weekly') {
    next.setDate(next.getDate() + periods * 7)
    return next
  }

  if (loanType === 'carrito') {
    next.setDate(next.getDate() + periods * (frequency === 'daily' ? 1 : 7))
    return next
  }

  next.setMonth(next.getMonth() + periods)
  return next
}

function getScheduledAmount(client: ClientPaymentHubRecord) {
  if (client.loanType === 'weekly') return client.result?.weeklyPayment ?? 0
  if (client.loanType === 'carrito') return client.result?.fixedPayment ?? 0
  return client.result?.monthlyPayment ?? 0
}

function getTotalInstallments(client: ClientPaymentHubRecord) {
  if (client.loanType === 'weekly') return client.result?.totalWeeks ?? 0
  if (client.loanType === 'carrito') return client.result?.numPayments ?? client.params?.numPayments ?? 0
  return client.result?.totalMonths ?? 0
}

function getPaidInstallments(client: ClientPaymentHubRecord, scheduledAmount: number) {
  const paymentRows = client.payments ?? []
  const maxCuota = paymentRows.reduce((max, payment) => Math.max(max, payment.cuotaNumber ?? 0), 0)
  if (maxCuota > 0) return maxCuota

  if (scheduledAmount <= 0) return paymentRows.length

  const paidTotal = paymentRows.reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
  return Math.floor(paidTotal / scheduledAmount)
}

function buildDueItem(client: ClientPaymentHubRecord, today: Date): DueItem | null {
  if (client.loanStatus && client.loanStatus !== 'approved') return null

  const startDate = toDate(client.params?.startDate)
  if (!startDate) return null

  const currency = client.params?.currency ?? 'USD'
  const scheduledAmount = getScheduledAmount(client)
  const totalInstallments = getTotalInstallments(client)
  const paidInstallments = getPaidInstallments(client, scheduledAmount)

  if (scheduledAmount <= 0 || totalInstallments <= 0 || paidInstallments >= totalInstallments) return null

  const frequency = client.params?.frequency ?? 'weekly'
  const nextDueDate = addPeriods(startDate, client.loanType, frequency, paidInstallments)
  const daysFromToday = diffInDays(nextDueDate, today)

  if (daysFromToday > 7) return null

  return {
    clientId: client.id,
    clientName: client.name,
    branchName: client.branchName,
    currency,
    scheduledAmount,
    nextDueDate: toIsoDate(nextDueDate),
    daysFromToday,
    status: daysFromToday < 0 ? 'overdue' : 'due-soon',
  }
}

function buildRecentPayments(clients: ClientPaymentHubRecord[]) {
  return clients
    .flatMap((client) =>
      (client.payments ?? []).map((payment) => ({
        clientId: client.id,
        clientName: client.name,
        currency: client.params?.currency ?? 'USD',
        amount: payment.amount ?? 0,
        date: payment.date,
        notes: payment.notes,
      })),
    )
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 8)
}

export default function PaymentsHub({
  onQuickPay,
  onViewClient,
  onViewLoans,
}: {
  onQuickPay: () => void
  onViewClient: (clientId: string) => void
  onViewLoans: () => void
}) {
  const [clients, setClients] = useState<ClientPaymentHubRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')

    fetch('/api/clients')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'No se pudo cargar el centro de pagos.')
        setClients(data.clients ?? [])
      })
      .catch((fetchError: any) => setError(fetchError?.message ?? 'No se pudo cargar el centro de pagos.'))
      .finally(() => setLoading(false))
  }, [])

  const today = useMemo(() => new Date(), [])

  const dueItems = useMemo(() => {
    return clients
      .map((client) => buildDueItem(client, today))
      .filter((item): item is DueItem => Boolean(item))
      .sort((left, right) => left.daysFromToday - right.daysFromToday)
  }, [clients, today])

  const overdueItems = dueItems.filter((item) => item.status === 'overdue')
  const dueSoonItems = dueItems.filter((item) => item.status === 'due-soon')
  const recentPayments = useMemo(() => buildRecentPayments(clients), [clients])

  const searchResults = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return []

    return clients
      .filter((client) =>
        [client.name, client.phone, client.email, client.branchName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized)),
      )
      .slice(0, 8)
  }, [clients, search])

  const paymentsTodayCount = recentPayments
    .filter((payment) => payment.date === toIsoDate(today))
    .length


  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.06)] sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Pagos</p>
        <h2 className="mt-2 text-xl font-display text-slate-900">Centro de pagos</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {'Todo el flujo de cobranza m\u00F3vil vive aqu\u00ED: registrar pagos r\u00E1pido, revisar vencidos y buscar clientes antes de cobrar.'}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button onClick={onQuickPay} className="min-h-[56px] rounded-2xl px-4 text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#1565C0,#0D2B5E)' }}>
            Quick Pay
          </button>
          <button onClick={onViewLoans} className="min-h-[56px] rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">
            Ver cartera
          </button>
          <button onClick={() => setSearch('')} className="min-h-[56px] rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">
            {'Limpiar b\u00FAsqueda'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-100 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Vencidos</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{overdueItems.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Por cobrar</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{dueSoonItems.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Pagos hoy</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{paymentsTodayCount}</p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Actividad</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{recentPayments.length}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.06)] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{'B\u00FAsqueda'}</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">Buscar cliente para cobrar</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {search.trim() ? `${searchResults.length} resultados` : 'R\u00E1pido'}
          </span>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 focus-within:border-blue-500 focus-within:bg-white">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={'Buscar por cliente, tel\u00E9fono o sucursal'}
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>

        {search.trim() ? (
          <div className="mt-4 space-y-2">
            {searchResults.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                {'No hay clientes que coincidan con la b\u00FAsqueda.'}
              </div>
            ) : (
              searchResults.map((client) => (
                <button key={client.id} onClick={() => onViewClient(client.id)} className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold text-slate-900">{client.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{[client.phone, client.email, client.branchName].filter(Boolean).join(' · ') || 'Sin datos adicionales'}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      Abrir
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-red-100 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.06)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-400">Prioridad</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">Pagos vencidos</h3>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-red-700">
              {overdueItems.length}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">Cargando cartera...</p>
            ) : overdueItems.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No hay pagos vencidos en este momento.</div>
            ) : (
              overdueItems.slice(0, 6).map((item) => (
                <button key={`${item.clientId}-${item.nextDueDate}`} onClick={() => onViewClient(item.clientId)} className="w-full rounded-2xl border border-red-100 bg-red-50/60 px-4 py-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold text-slate-900">{item.clientName}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.branchName || 'Sin sucursal'} · Vence {item.nextDueDate}</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="break-words text-sm font-bold text-red-700">{formatCurrency(item.scheduledAmount, item.currency as any)}</p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-red-500">{Math.abs(item.daysFromToday)} d\u00EDas tarde</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-amber-100 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.06)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">Seguimiento</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">{'Pr\u00F3ximos pagos'}</h3>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">
              {dueSoonItems.length}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">Cargando cartera...</p>
            ) : dueSoonItems.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{'No hay pagos por vencer en los pr\u00F3ximos 7 d\u00EDas.'}</div>
            ) : (
              dueSoonItems.slice(0, 6).map((item) => (
                <button key={`${item.clientId}-${item.nextDueDate}`} onClick={() => onViewClient(item.clientId)} className="w-full rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold text-slate-900">{item.clientName}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.branchName || 'Sin sucursal'} · Cobra {item.nextDueDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(item.scheduledAmount, item.currency as any)}</p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-600">{item.daysFromToday === 0 ? 'Hoy' : `En ${item.daysFromToday} d\u00EDas`}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.06)] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Actividad</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">Pagos recientes</h3>
          </div>
          <button onClick={onQuickPay} className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
            Registrar
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Cargando actividad...</p>
        ) : error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : recentPayments.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{'Todav\u00EDa no hay pagos recientes.'}</div>
        ) : (
          <div className="mt-4 space-y-2">
            {recentPayments.map((payment) => (
              <button key={payment.clientId + payment.date + payment.amount} onClick={() => onViewClient(payment.clientId)} className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-slate-900">{payment.clientName}</p>
                    <p className="mt-1 text-xs text-slate-500">{payment.date}{payment.notes ? ` · ${payment.notes}` : ''}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(payment.amount, payment.currency as any)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

