'use client'

import { LOAN_TYPES, type LoanType } from '@/lib/loan'

const LABELS: Record<LoanType, string> = {
  amortized: 'Mensual',
  weekly: 'Semanal',
  carrito: 'Carrito',
}

const SUBTITLES: Record<LoanType, string> = {
  amortized: 'Cuotas mensuales con saldo amortizado',
  weekly: 'Cobro semanal para operacion en calle',
  carrito: 'Interes plano con pagos diarios o semanales',
}

export default function LoanTypeSelector({
  value,
  onChange,
}: {
  value: LoanType
  onChange: (value: LoanType) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {LOAN_TYPES.map((option) => {
        const active = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className="rounded-2xl border px-4 py-4 text-left transition-all"
            style={{
              borderColor: active ? '#1565C0' : '#E2E8F0',
              background: active ? '#EEF4FF' : '#FFFFFF',
              boxShadow: active ? '0 0 0 3px rgba(21,101,192,.12)' : '0 1px 6px rgba(15,23,42,.04)',
            }}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-2xl leading-none">{option.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: active ? '#0D2B5E' : '#1E293B' }}>
                  {LABELS[option.id]}
                </p>
                <p className="mt-1 text-xs text-slate-500">{SUBTITLES[option.id]}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

