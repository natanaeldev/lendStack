'use client'

export type CalculatorLoanKind = 'weekly' | 'monthly' | 'carrito' | 'amortized'

const OPTIONS: { id: CalculatorLoanKind; label: string; description: string; badge: string }[] = [
  { id: 'weekly', label: 'Semanal', description: 'Cuotas reducidas por semana', badge: '7 días' },
  { id: 'monthly', label: 'Mensual', description: 'Simulación rápida por meses', badge: '12 cuotas' },
  { id: 'carrito', label: 'Carrito', description: 'Interés plano para ruta', badge: 'Cobro fijo' },
  { id: 'amortized', label: 'Amortizado', description: 'Saldo reducible profesional', badge: 'Institucional' },
]

export default function LoanTypeSelector({ value, onChange }: { value: CalculatorLoanKind; onChange: (value: CalculatorLoanKind) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {OPTIONS.map((option) => {
        const active = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className="min-w-0 rounded-[24px] border px-4 py-4 text-left transition"
            style={{
              borderColor: active ? '#1D4ED8' : '#E2E8F0',
              background: active ? 'linear-gradient(135deg,#EFF6FF,#FFFFFF)' : '#FFFFFF',
              boxShadow: active ? '0 14px 30px rgba(29,78,216,.12)' : 'none',
            }}
          >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <p className="text-balance break-words whitespace-normal text-sm font-black text-slate-950">{option.label}</p>
                <p className="mt-1 break-words whitespace-normal text-xs leading-5 text-slate-500">{option.description}</p>
              </div>
              <span className="max-w-full break-words whitespace-normal rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:shrink-0">{option.badge}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
