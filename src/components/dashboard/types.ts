'use client'

import type { Currency } from '@/lib/loan'

export interface RecentClient {
  id: string
  name: string
  email: string
  savedAt: string
  amount: number
  profile: string
  currency: Currency
  monthlyPayment: number
}

export interface ClientDoc {
  id: string
  name: string
  url: string
  type: string
  size: number
  uploadedAt: string
}

export interface ClientRow {
  id: string
  name: string
  email: string
  phone: string
  notes: string
  savedAt: string
  params: any
  result: any
  documents: ClientDoc[]
  loanStatus?: string
  payments?: { id: string; date: string; amount: number; cuotaNumber?: number; notes?: string }[]
}

export interface StatsData {
  configured: boolean
  totalClients: number
  totalLoans: number
  totalAmount: number
  avgMonthlyPayment: number
  avgAmount: number
  totalInterest: number
  avgTermMonths: number
  totalMonthlyPayments: number
  totalMonthlyIncome: number
  approvedCapital: number
  pendingCount: number
  approvedCount: number
  deniedCount: number
  collectedToday: number
  collectedWeek: number
  collectedMonth: number
  collectionRate: number
  paidPeriodsCount: number
  overdueAmountByCurrency: { currency: string; amount: number }[]
  byProfile: { profile: string; count: number; totalAmount: number }[]
  byCurrency: { currency: string; count: number; totalAmount: number }[]
  avgPaymentByCurrency: { currency: string; avgMonthlyPayment: number; count: number }[]
  recoveryByCurrency: { currency: string; totalAmount: number; totalRecovered: number; percentage: number }[]
  recentClients: RecentClient[]
  baseCurrency?: 'USD'
  exchangeRatesPerUsd?: Record<string, number>
  portfolio?: {
    totalLoansCount: number
    totalDisbursed: number
    activePortfolio: number
    totalActiveCount: number
    delinquentCount: number
    overdueAmountTotal: number
    totalPrincipalOriginated?: number
    paidOffCount: number
    pendingApprovalCount: number
    approvalRate: number
    dueTodayCount: number
    dueTodayAmount: number
    collectedMonth: number
    byLifecycle: { status: string; count: number }[]
  }
}

export interface OrgInfo {
  plan: string
  billingPlan?: string
  billingStatus?: string
  billingInterval?: string | null
  currentPeriodEnd?: string | null
  trialEndsAt?: string | null
  isPaymentPastDue?: boolean
  stripeConnectStatus?: string
  canManageBilling?: boolean
  canConnectStripe?: boolean
  portalAvailable?: boolean
  checkoutAvailable?: boolean
  clientCount: number
  maxClients: number | null
  isAtLimit: boolean
  isNearLimit: boolean
  orgName: string
}

export type UrgentStatus = 'overdue' | 'due_today' | 'upcoming'

export interface UrgentItem {
  clientId: string
  clientName: string
  phone?: string
  currency: Currency
  amount: number
  dueDate: string
  daysFromToday: number
  status: UrgentStatus
  branchName?: string | null
}

export interface RecentActivityItem {
  id: string
  type: 'payment' | 'client'
  title: string
  subtitle: string
  meta: string
  amountLabel?: string
  date: string
  clientId?: string
}
