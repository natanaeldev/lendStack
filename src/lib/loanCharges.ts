import { v4 as uuidv4 } from 'uuid'
import type { LoanChargeDoc, LoanChargeType } from './loanDomain'

export const LOAN_CHARGE_LABELS: Record<LoanChargeType, string> = {
  origination_cost: 'Costo de originacion',
  gastos_procesales: 'Gastos procesales',
}

export interface LoanChargeInput {
  type: LoanChargeType
  amount: number
  financed: boolean
}

export interface LoanChargeSummary {
  financed: number
  upfront: number
  totalFinancedAmount: number
  netDisbursedAmount: number
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return NaN
}

export function normalizeLoanCharges(input: unknown): LoanChargeInput[] {
  if (!Array.isArray(input)) return []

  const deduped = new Map<LoanChargeType, LoanChargeInput>()

  for (const rawCharge of input) {
    const type = rawCharge && typeof rawCharge === 'object' ? (rawCharge as any).type : undefined
    if (type !== 'origination_cost' && type !== 'gastos_procesales') {
      throw new Error('Tipo de cargo invalido.')
    }

    const rawAmount = rawCharge && typeof rawCharge === 'object' ? (rawCharge as any).amount : undefined
    if (rawAmount === '' || rawAmount == null) continue

    const amount = toFiniteNumber(rawAmount)
    if (Number.isNaN(amount)) {
      throw new Error(`Monto invalido para el cargo "${type}".`)
    }
    if (amount < 0) {
      throw new Error(`El cargo "${type}" no puede ser negativo.`)
    }
    if (amount === 0) continue

    deduped.set(type, {
      type,
      amount: roundMoney(amount),
      financed: Boolean((rawCharge as any).financed),
    })
  }

  return Array.from(deduped.values())
}

export function summarizeLoanCharges(baseAmount: number, charges: LoanChargeInput[]): LoanChargeSummary {
  const financed = roundMoney(
    charges.filter((charge) => charge.financed).reduce((sum, charge) => sum + charge.amount, 0),
  )
  const upfront = roundMoney(
    charges.filter((charge) => !charge.financed).reduce((sum, charge) => sum + charge.amount, 0),
  )

  return {
    financed,
    upfront,
    totalFinancedAmount: roundMoney(baseAmount + financed),
    netDisbursedAmount: roundMoney(baseAmount - upfront),
  }
}

export function buildLoanChargeDocs(
  loanId: string,
  organizationId: string,
  charges: LoanChargeInput[],
  now: string,
): LoanChargeDoc[] {
  return charges.map((charge) => ({
    _id: uuidv4(),
    organizationId,
    loanId,
    type: charge.type,
    label: LOAN_CHARGE_LABELS[charge.type],
    amount: charge.amount,
    financed: charge.financed,
    createdAt: now,
    updatedAt: now,
  }))
}
