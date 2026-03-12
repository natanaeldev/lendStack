import type {
  CarritoFrequency,
  Currency,
  LoanType,
  RateMode,
  RiskProfile,
} from '@/lib/loan'

export type PrestamoClientOption = {
  id: string
  name: string
  email?: string
  phone?: string
  branchName?: string | null
}

export type PrestamoFormState = {
  clientId: string
  loanType: LoanType
  amount: number
  currency: Currency
  startDate: string
  notes: string
  monthlyTermMonths: number
  monthlyProfile: RiskProfile
  monthlyRateMode: RateMode
  monthlyCustomRate: number
  weeklyTermWeeks: number
  weeklyMonthlyRate: number
  carritoFlatRate: number
  carritoTerm: number
  carritoPayments: number
  carritoFrequency: CarritoFrequency
}

export type PrestamoPreview = {
  frequencyLabel: string
  installments: number
  scheduledPayment: number
  totalPayment: number
  totalInterest: number
  rateLabel: string
}

