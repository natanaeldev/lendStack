'use client'

import { LOAN_TYPES, type LoanType } from '@/lib/loan'

const LABELS: Record<LoanType, string> = {
  amortized: 'Mensual',
  weekly: 'Semanal',
  carrito: 'Carrito',
}

const SUBTITLES: Record<LoanType, string> = {
  amortized: 'Cuotas mensuales con saldo amortizado',
  weekly: 'Cobro semanal con saldo amortizado',
  carrito: 'Interés total sobre capital con pagos diarios o semanales',
}

const HINTS: Record<LoanType, string> = {
  amortized: 'Ideal para préstamos con mayor plazo y cuota estable.',
  weekly: 'Ideal para ruta activa y seguimiento frecuente.',
  carrito: 'Ideal para producto rápido con cuota fija y cálculo explícito.',
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
            className="min-h-[124px] rounded-[26px] border px-4 py-4 text-left transition-all sm:min-h-[148px]"
            style={{
              borderColor: active ? '#1565C0' : '#E2E8F0',
              background: active ? 'linear-gradient(180deg,#F8FBFF 0%,#EEF4FF 100%)' : '#FFFFFF',
              boxShadow: active ? '0 0 0 3px rgba(21,101,192,.12), 0 18px 36px rgba(13,43,94,.08)' : '0 10px 24px rgba(15,23,42,.05)',
            }}
            aria-pressed={active}
          >
            <div className="flex h-full flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ background: active ? '#DCEBFF' : '#F8FAFC' }}>
                    {option.emoji}
                  </span>
                  <div className="min-w-0 pt-1">
                    <p className="text-base font-bold" style={{ color: active ? '#0D2B5E' : '#1E293B' }}>
                      {LABELS[option.id]}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{SUBTITLES[option.id]}</p>
                  </div>
                </div>
                <span
                  className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-2 text-[11px] font-bold uppercase tracking-[0.16em]"
                  style={{
                    borderColor: active ? '#1565C0' : '#CBD5E1',
                    color: active ? '#1565C0' : '#64748B',
                    background: active ? '#FFFFFF' : '#F8FAFC',
                  }}
                >
                  {active ? 'Listo' : 'Elegir'}
                </span>
              </div>

              <div className="mt-auto rounded-2xl px-3 py-3 text-xs font-medium leading-5" style={{ background: active ? 'rgba(255,255,255,.8)' : '#F8FAFC', color: active ? '#1E3A5F' : '#475569' }}>
                {HINTS[option.id]}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
