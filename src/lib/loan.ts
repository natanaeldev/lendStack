// ─── Risk Profiles ────────────────────────────────────────────────────────────

export type RiskProfile = 'Low Risk' | 'Medium Risk' | 'High Risk'

export interface RiskConfig {
  label:       RiskProfile
  minRate:     number
  midRate:     number
  maxRate:     number
  description: string
  emoji:       string
  colorBg:     string
  colorText:   string
  colorAccent: string
  activeClass: string
}

export const RISK_PROFILES: RiskConfig[] = [
  {
    label: 'Low Risk', minRate: 0.05, midRate: 0.06, maxRate: 0.07,
    description: 'Creditworthy borrowers, stable income & strong collateral',
    emoji: '🟢', colorBg: '#E8F5E9', colorText: '#1B5E20', colorAccent: '#2E7D32',
    activeClass: 'ring-2 ring-green-500 bg-green-50 border-green-500',
  },
  {
    label: 'Medium Risk', minRate: 0.08, midRate: 0.09, maxRate: 0.10,
    description: 'Average credit profile, some income variability',
    emoji: '🟡', colorBg: '#FFF8E1', colorText: '#6D4C00', colorAccent: '#F59E0B',
    activeClass: 'ring-2 ring-amber-400 bg-amber-50 border-amber-400',
  },
  {
    label: 'High Risk', minRate: 0.13, midRate: 0.14, maxRate: 0.15,
    description: 'Elevated credit risk, limited collateral or credit history',
    emoji: '🔴', colorBg: '#FFEBEE', colorText: '#B71C1C', colorAccent: '#EF4444',
    activeClass: 'ring-2 ring-red-500 bg-red-50 border-red-500',
  },
]

export function getRiskConfig(profile: RiskProfile): RiskConfig {
  return RISK_PROFILES.find((r) => r.label === profile)!
}

// ─── Rate Mode ────────────────────────────────────────────────────────────────

/** 'annual'  → rate comes from the risk profile, monthly = annual / 12
 *  'monthly' → user supplies a custom monthly rate directly (not divided by 12) */
export type RateMode = 'annual' | 'monthly'

// ─── Currency ─────────────────────────────────────────────────────────────────

export type Currency = 'USD' | 'ARS' | 'EUR' | 'DOP'

export interface CurrencyConfig {
  code: Currency; symbol: string; label: string; locale: string; flag: string
}

export const CURRENCIES: Record<Currency, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$',   label: 'USD', locale: 'en-US', flag: '🇺🇸' },
  ARS: { code: 'ARS', symbol: '$',   label: 'ARS', locale: 'es-AR', flag: '🇦🇷' },
  EUR: { code: 'EUR', symbol: '€',   label: 'EUR', locale: 'de-DE', flag: '🇪🇺' },
  DOP: { code: 'DOP', symbol: 'RD$', label: 'DOP', locale: 'es-DO', flag: '🇩🇴' },
}

export function formatCurrency(value: number, currency: Currency): string {
  const c = CURRENCIES[currency]
  return new Intl.NumberFormat(c.locale, {
    style: 'currency', currency: c.code,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value: number, decimals = 2): string {
  return (value * 100).toFixed(decimals) + '%'
}

// ─── Calculations ─────────────────────────────────────────────────────────────

export interface LoanParams {
  amount: number; termYears: number; profile: RiskProfile; currency: Currency
  /** Rate basis — defaults to 'annual' when omitted (backward compatible) */
  rateMode?: RateMode
  /** Monthly rate as a decimal, e.g. 0.015 for 1.5% — used only when rateMode === 'monthly' */
  customMonthlyRate?: number
}

export interface LoanResult {
  annualRate: number; monthlyRate: number; totalMonths: number
  monthlyPayment: number; totalPayment: number; totalInterest: number; interestRatio: number
}

export function calculateLoan(params: LoanParams): LoanResult {
  const { amount, termYears, profile, rateMode = 'annual', customMonthlyRate } = params
  const config = getRiskConfig(profile)

  let annualRate: number
  let monthlyRate: number

  if (rateMode === 'monthly' && customMonthlyRate != null && customMonthlyRate > 0) {
    // Monthly mode: user-supplied monthly rate is used directly in the formula
    monthlyRate = customMonthlyRate
    annualRate  = monthlyRate * 12
  } else {
    // Annual mode (default): derive monthly rate from the risk-profile annual rate
    annualRate  = config.midRate
    monthlyRate = annualRate / 12
  }

  const totalMonths = termYears * 12
  const monthlyPayment =
    monthlyRate === 0
      ? amount / Math.max(totalMonths, 1)
      : (amount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1)
  const totalPayment  = monthlyPayment * totalMonths
  const totalInterest = totalPayment - amount
  return { annualRate, monthlyRate, totalMonths, monthlyPayment, totalPayment, totalInterest, interestRatio: totalInterest / amount }
}

export interface AmortizationRow {
  month: number; openingBalance: number; payment: number
  principal: number; interest: number; closingBalance: number
  cumInterest: number; cumPrincipal: number
}

export function buildAmortization(params: LoanParams): AmortizationRow[] {
  const result = calculateLoan(params)
  const rows: AmortizationRow[] = []
  let balance = params.amount, cumInterest = 0, cumPrincipal = 0
  for (let m = 1; m <= result.totalMonths; m++) {
    const interest  = balance * result.monthlyRate
    const principal = result.monthlyPayment - interest
    const closing   = Math.max(balance - principal, 0)
    cumInterest += interest; cumPrincipal += principal
    rows.push({ month: m, openingBalance: balance, payment: result.monthlyPayment, principal, interest, closingBalance: closing, cumInterest, cumPrincipal })
    balance = closing
  }
  return rows
}

// ─── Client ───────────────────────────────────────────────────────────────────

export interface ClientDocument {
  id: string; name: string; url: string; type: string; size: number; uploadedAt: string
}

export interface Client {
  id: string; name: string; email: string; phone: string; notes: string
  params: LoanParams; result: LoanResult; savedAt: string
  documents?: ClientDocument[]
}

// ─── Multi-Loan ───────────────────────────────────────────────────────────────

export interface LoanSlot {
  id: string; label: string; color: string; params: LoanParams; result: LoanResult
}
