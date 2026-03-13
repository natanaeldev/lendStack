import {
  type Branch,
  formatCurrency,
  type LoanParams,
  type LoanType,
  type CarritoFrequency,
  type Currency,
  type RiskProfile,
  RISK_PROFILES,
} from '@/lib/loan'

export type LoanStatus = 'pending' | 'approved' | 'denied'
export type StorageMode = 'loading' | 'local' | 'cloud'
export type ClientFilterKey = 'all' | 'active' | 'delinquent' | 'no-loan'
export type ClientPortfolioStatus = 'active' | 'delinquent' | 'pending-review' | 'no-loan'

export interface ClientDoc {
  id: string
  name: string
  url: string
  type: string
  size: number
  uploadedAt: string
}

export interface Payment {
  id: string
  date: string
  amount: number
  cuotaNumber?: number
  notes?: string
}

export interface BranchDoc {
  id: string
  name: string
  type: Branch
}

export interface ClientLoanParams {
  amount: number
  termYears?: number | null
  profile: RiskProfile
  currency: Currency
  rateMode?: 'annual' | 'monthly'
  customMonthlyRate?: number
  startDate?: string
  termWeeks?: number | null
  monthlyRate?: number | null
  flatRate?: number | null
  carritoTerm?: number | null
  numPayments?: number | null
  frequency?: CarritoFrequency | null
}

export interface ClientLoanResult {
  annualRate?: number
  monthlyRate?: number
  totalMonths?: number | null
  monthlyPayment: number
  totalPayment: number
  totalInterest: number
  interestRatio?: number
  weeklyPayment?: number | null
  weeklyRate?: number | null
  totalWeeks?: number | null
  fixedPayment?: number | null
  numPayments?: number | null
}

export interface ClientRecord {
  id: string
  savedAt: string
  name: string
  email: string
  phone: string
  idType: string
  idNumber: string
  birthDate: string
  nationality: string
  address: string
  occupation: string
  monthlyIncome: string
  hasIncomeProof: boolean
  currentDebts: string
  totalDebtValue: string
  paymentCapacity: string
  collateral: string
  territorialTies: string
  creditHistory: string
  reference1: string
  reference2: string
  notes: string
  branch: Branch | null
  branchId: string | null
  branchName: string | null
  loanStatus: LoanStatus
  lifecycleStatus?: string | null
  loanType?: LoanType
  params: ClientLoanParams
  result: ClientLoanResult
  documents?: ClientDoc[]
  payments?: Payment[]
}

export const BRANCH_STYLES: Record<Branch, { label: string; tone: string }> = {
  sede: { label: 'Sede', tone: 'sky' },
  rutas: { label: 'Rutas', tone: 'amber' },
}

export const BADGE_TONES: Record<
  string,
  { background: string; border: string; color: string }
> = {
  success: { background: '#ECFDF5', border: '#86EFAC', color: '#166534' },
  danger: { background: '#FEF2F2', border: '#FCA5A5', color: '#B91C1C' },
  warning: { background: '#FFFBEB', border: '#FCD34D', color: '#92400E' },
  neutral: { background: '#F8FAFC', border: '#CBD5E1', color: '#475569' },
  info: { background: '#EFF6FF', border: '#93C5FD', color: '#1D4ED8' },
  sky: { background: '#F0F9FF', border: '#7DD3FC', color: '#0369A1' },
  amber: { background: '#FFF7ED', border: '#FDBA74', color: '#9A3412' },
}

export function getRiskProfile(profile?: RiskProfile) {
  return RISK_PROFILES.find((item) => item.label === profile) ?? RISK_PROFILES[1]
}

export function getInitials(name: string) {
  const initials = name
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return initials || 'CL'
}

export function formatShortDate(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatPhone(phone?: string | null) {
  return phone?.trim() ? phone.trim() : 'No disponible'
}

export function phoneHref(phone?: string | null) {
  if (!phone?.trim()) return null
  const compact = phone.replace(/[^\d+]/g, '')
  return compact ? `tel:${compact}` : null
}

export function formatClientField(value?: string | number | null) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'No disponible'
  return value.trim() ? value.trim() : '—'
}

export function getScheduledPayment(client: ClientRecord) {
  if (client.loanType === 'weekly') return client.result.weeklyPayment ?? client.result.monthlyPayment ?? 0
  if (client.loanType === 'carrito') return client.result.fixedPayment ?? client.result.monthlyPayment ?? 0
  return client.result.monthlyPayment ?? 0
}

export function getLoanTypeLabel(client: ClientRecord) {
  if (client.loanType === 'weekly') return 'Semanal'
  if (client.loanType === 'carrito') return 'Carrito'
  return 'Amortizado'
}

export function getTotalInstallments(client: ClientRecord) {
  if (client.loanType === 'weekly') return Number(client.result.totalWeeks ?? client.params.termWeeks ?? 0)
  if (client.loanType === 'carrito') return Number(client.result.numPayments ?? client.params.numPayments ?? 0)
  return Number(client.result.totalMonths ?? ((client.params.termYears ?? 0) * 12))
}

export function getPaidInstallments(client: ClientRecord) {
  const payments = client.payments ?? []
  const scheduledPayment = getScheduledPayment(client)
  const byAmount =
    scheduledPayment > 0
      ? Math.floor((payments.reduce((sum, payment) => sum + payment.amount, 0) + 0.001) / scheduledPayment)
      : 0
  const byQuota = payments.reduce((max, payment) => Math.max(max, payment.cuotaNumber ?? 0), 0)
  return Math.max(byAmount, byQuota)
}

export function getTotalPaid(client: ClientRecord) {
  return (client.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0)
}

function diffDays(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000)
}

export function getExpectedInstallments(client: ClientRecord, today = new Date()) {
  if (!client.params?.startDate) return 0
  const startDate = new Date(client.params.startDate)
  if (Number.isNaN(startDate.getTime()) || today < startDate) return 0

  const totalInstallments = Math.max(0, getTotalInstallments(client))

  if (client.loanType === 'weekly') {
    return Math.min(totalInstallments, Math.floor(diffDays(today, startDate) / 7) + 1)
  }

  if (client.loanType === 'carrito') {
    const frequency = client.params.frequency ?? 'weekly'
    if (frequency === 'daily') {
      return Math.min(totalInstallments, diffDays(today, startDate) + 1)
    }
    return Math.min(totalInstallments, Math.floor(diffDays(today, startDate) / 7) + 1)
  }

  const months =
    (today.getFullYear() - startDate.getFullYear()) * 12 +
    (today.getMonth() - startDate.getMonth()) +
    (today.getDate() >= startDate.getDate() ? 1 : 0)
  return Math.min(totalInstallments, Math.max(0, months))
}

export function getClientPortfolioStatus(client: ClientRecord): ClientPortfolioStatus {
  if (client.loanStatus !== 'approved') {
    return client.loanStatus === 'pending' ? 'pending-review' : 'no-loan'
  }

  if (getExpectedInstallments(client) > getPaidInstallments(client)) {
    return 'delinquent'
  }

  return 'active'
}

export function getPortfolioBadge(status: ClientPortfolioStatus) {
  switch (status) {
    case 'active':
      return { label: 'Activo', tone: 'success' }
    case 'delinquent':
      return { label: 'Moroso', tone: 'danger' }
    case 'pending-review':
      return { label: 'En evaluación', tone: 'warning' }
    default:
      return { label: 'Sin préstamo', tone: 'neutral' }
  }
}

export function getApplicationBadge(status: LoanStatus) {
  switch (status) {
    case 'approved':
      return { label: 'Aprobado', tone: 'success' }
    case 'denied':
      return { label: 'Denegado', tone: 'danger' }
    default:
      return { label: 'Pendiente', tone: 'warning' }
  }
}

export function getClientSummary(client: ClientRecord) {
  const currency = client.params.currency
  const scheduledPayment = getScheduledPayment(client)
  const totalPaid = getTotalPaid(client)
  const totalPayment = client.result.totalPayment ?? 0
  const outstanding = Math.max(totalPayment - totalPaid, 0)
  const paidInstallments = getPaidInstallments(client)
  const totalInstallments = Math.max(getTotalInstallments(client), 0)
  const portfolioStatus = getClientPortfolioStatus(client)

  if (portfolioStatus === 'no-loan') return 'Sin préstamo activo'
  if (portfolioStatus === 'pending-review') return 'Solicitud en evaluación'

  const cadence =
    client.loanType === 'weekly'
      ? 'semana'
      : client.loanType === 'carrito'
        ? client.params.frequency === 'daily'
          ? 'día'
          : 'semana'
        : 'mes'

  return [
    `${formatCurrency(scheduledPayment, currency)} / ${cadence}`,
    totalInstallments > 0 ? `${paidInstallments}/${totalInstallments} cuotas pagadas` : null,
    outstanding > 0 ? `Saldo ${formatCurrency(outstanding, currency)}` : 'Saldo liquidado',
  ]
    .filter(Boolean)
    .join(' · ')
}

export function getOutstandingLabel(client: ClientRecord) {
  const outstanding = Math.max((client.result.totalPayment ?? 0) - getTotalPaid(client), 0)
  return formatCurrency(outstanding, client.params.currency)
}

export function getClientLoanAmount(client: ClientRecord) {
  return formatCurrency(client.params.amount ?? 0, client.params.currency)
}

export function matchesClientSearch(client: ClientRecord, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true

  return [client.name, client.email, client.phone, client.idNumber]
    .map((value) => value?.toLowerCase() ?? '')
    .some((value) => value.includes(query))
}

export function asLoanParams(client: ClientRecord): LoanParams {
  return {
    amount: client.params.amount,
    termYears: Number(client.params.termYears ?? 1),
    profile: client.params.profile,
    currency: client.params.currency,
    rateMode: client.params.rateMode ?? 'annual',
    customMonthlyRate: client.params.customMonthlyRate,
    startDate: client.params.startDate,
  }
}
