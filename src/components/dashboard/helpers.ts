'use client'

import type { Currency } from '@/lib/loan'
import type { ClientRow, RecentActivityItem, RecentClient, UrgentItem, UrgentStatus } from './types'

function toDate(value?: string | null) {
  if (!value) return null
  const parsed = new Date(`${value}T12:00:00`)
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

function addPeriods(start: Date, loanType: string | undefined, frequency: 'daily' | 'weekly', periods: number) {
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

function getLoanType(client: ClientRow) {
  return String(client.params?.loanType ?? client.result?.loanType ?? 'amortized').toLowerCase()
}

function getScheduledAmount(client: ClientRow) {
  const loanType = getLoanType(client)
  if (loanType === 'weekly') return client.result?.weeklyPayment ?? 0
  if (loanType === 'carrito') return client.result?.fixedPayment ?? 0
  return client.result?.monthlyPayment ?? client.params?.scheduledPayment ?? 0
}

function getTotalInstallments(client: ClientRow) {
  const loanType = getLoanType(client)
  if (loanType === 'weekly') return client.result?.totalWeeks ?? client.params?.termWeeks ?? 0
  if (loanType === 'carrito') return client.result?.numPayments ?? client.params?.numPayments ?? 0
  return client.result?.totalMonths ?? (client.params?.termYears ?? 0) * 12
}

function getPaidInstallments(client: ClientRow, scheduledAmount: number) {
  const rows = client.payments ?? []
  const maxCuota = rows.reduce((max, payment) => Math.max(max, payment.cuotaNumber ?? 0), 0)
  if (maxCuota > 0) return maxCuota
  if (scheduledAmount <= 0) return rows.length
  const paidTotal = rows.reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
  return Math.floor(paidTotal / scheduledAmount)
}

function buildUrgentItem(client: ClientRow, today: Date): UrgentItem | null {
  if (client.loanStatus === 'denied') return null
  const startDate = toDate(client.params?.startDate)
  if (!startDate) return null
  const loanType = getLoanType(client)
  const scheduledAmount = getScheduledAmount(client)
  const totalInstallments = getTotalInstallments(client)
  const paidInstallments = getPaidInstallments(client, scheduledAmount)
  if (scheduledAmount <= 0 || totalInstallments <= 0 || paidInstallments >= totalInstallments) return null

  const frequency = (client.params?.frequency ?? 'weekly') as 'daily' | 'weekly'
  const nextDueDate = addPeriods(startDate, loanType, frequency, paidInstallments)
  const daysFromToday = diffInDays(nextDueDate, today)

  let status: UrgentStatus | null = null
  if (daysFromToday < 0) status = 'overdue'
  else if (daysFromToday === 0) status = 'due_today'
  else if (daysFromToday <= 7) status = 'upcoming'
  if (!status) return null

  return {
    clientId: client.id,
    clientName: client.name,
    phone: client.phone,
    currency: (client.params?.currency ?? 'USD') as Currency,
    amount: scheduledAmount,
    dueDate: toIsoDate(nextDueDate),
    daysFromToday,
    status,
    branchName: client.params?.branchName ?? null,
  }
}

export function buildUrgentItems(clients: ClientRow[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return clients
    .map((client) => buildUrgentItem(client, today))
    .filter((item): item is UrgentItem => Boolean(item))
    .sort((left, right) => left.daysFromToday - right.daysFromToday)
}

export function buildRecentActivity(clients: ClientRow[], recentClients: RecentClient[], formatCurrencyLabel: (amount: number, currency?: Currency) => string) {
  const payments: RecentActivityItem[] = clients.flatMap((client) =>
    (client.payments ?? []).map((payment) => ({
      id: `payment-${client.id}-${payment.id}`,
      type: 'payment' as const,
      title: client.name,
      subtitle: payment.notes?.trim() || 'Pago registrado',
      meta: payment.cuotaNumber ? `Cuota #${payment.cuotaNumber}` : 'Pago manual',
      amountLabel: formatCurrencyLabel(payment.amount ?? 0, client.params?.currency ?? 'USD'),
      date: payment.date,
      clientId: client.id,
    })),
  )

  const createdClients: RecentActivityItem[] = recentClients.map((client) => ({
    id: `client-${client.id}`,
    type: 'client' as const,
    title: client.name,
    subtitle: client.email || 'Cliente incorporado recientemente',
    meta: client.profile || 'Perfil sin definir',
    amountLabel: formatCurrencyLabel(client.amount ?? 0, client.currency),
    date: client.savedAt,
    clientId: client.id,
  }))

  return [...payments, ...createdClients]
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 8)
}

export function formatDashboardDate(date = new Date()) {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

export function formatShortDate(value: string) {
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(parsed)
}
