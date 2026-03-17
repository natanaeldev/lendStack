'use client'

import { useEffect, useState } from 'react'
import type { LoanCharge, LoanChargeType } from './types'

const CHARGE_DEFS: { type: LoanChargeType; label: string }[] = [
  { type: 'origination_cost', label: 'Costo de originacion' },
  { type: 'gastos_procesales', label: 'Gastos procesales' },
]

interface Props {
  charges: LoanCharge[]
  onChange: (charges: LoanCharge[]) => void
}

export default function ChargesSection({ charges, onChange }: Props) {
  const [pendingFinanced, setPendingFinanced] = useState<Record<LoanChargeType, boolean>>({
    origination_cost: false,
    gastos_procesales: false,
  })

  useEffect(() => {
    setPendingFinanced({
      origination_cost: charges.find((charge) => charge.type === 'origination_cost')?.financed ?? false,
      gastos_procesales: charges.find((charge) => charge.type === 'gastos_procesales')?.financed ?? false,
    })
  }, [charges])

  function getCharge(type: LoanChargeType): LoanCharge | undefined {
    return charges.find((charge) => charge.type === type)
  }

  function handleAmountChange(type: LoanChargeType, label: string, raw: string) {
    if (raw.trim() === '') {
      onChange(charges.filter((charge) => charge.type !== type))
      return
    }

    const amount = Number(raw)
    if (Number.isNaN(amount) || amount < 0) {
      return
    }
    if (amount === 0) {
      onChange(charges.filter((charge) => charge.type !== type))
      return
    }

    const existing = getCharge(type)
    if (existing) {
      onChange(charges.map((charge) => (charge.type === type ? { ...charge, amount } : charge)))
      return
    }

    onChange([
      ...charges,
      {
        type,
        label,
        amount,
        financed: pendingFinanced[type] ?? false,
      },
    ])
  }

  function handleFinancedChange(type: LoanChargeType, financed: boolean) {
    setPendingFinanced((current) => ({ ...current, [type]: financed }))

    const existing = getCharge(type)
    if (!existing) return

    onChange(charges.map((charge) => (charge.type === type ? { ...charge, financed } : charge)))
  }

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base">+</span>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          Fees and Charges
        </p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
          Opcional
        </span>
      </div>
      <p className="mb-4 text-xs leading-5 text-slate-500">
        Deja en blanco los cargos que no apliquen. Los cargos financiados aumentan el capital y los cargos al contado reducen el neto a desembolsar.
      </p>

      <div className="space-y-3">
        {CHARGE_DEFS.map(({ type, label }) => {
          const charge = getCharge(type)
          const rawAmount = charge ? String(charge.amount) : ''
          const isFinanced = charge?.financed ?? pendingFinanced[type] ?? false

          return (
            <div
              key={type}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
            >
              <p className="mb-2 text-sm font-semibold text-slate-800">{label}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Monto
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={rawAmount}
                    onChange={(event) => handleAmountChange(type, label, event.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div className="flex-shrink-0">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Financiado
                  </label>
                  <div className="flex overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => handleFinancedChange(type, false)}
                      className="px-4 py-2 text-xs font-bold transition-colors"
                      style={
                        !isFinanced
                          ? { background: 'linear-gradient(135deg,#0D2B5E,#1565C0)', color: '#fff' }
                          : { background: 'transparent', color: '#64748B' }
                      }
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFinancedChange(type, true)}
                      className="px-4 py-2 text-xs font-bold transition-colors"
                      style={
                        isFinanced
                          ? { background: 'linear-gradient(135deg,#047857,#059669)', color: '#fff' }
                          : { background: 'transparent', color: '#64748B' }
                      }
                    >
                      Si
                    </button>
                  </div>
                </div>
              </div>

              {charge ? (
                <p className="mt-2 text-[11px] text-slate-400">
                  {isFinanced
                    ? `Se suma al capital: +${charge.amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `Se descuenta del desembolso: -${charge.amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-slate-400">
                  Sin monto no se guardara este cargo.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
