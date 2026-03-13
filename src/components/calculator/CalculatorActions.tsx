'use client'

export default function CalculatorActions({ onCalculate }: { onCalculate: () => void }) {
  return (
    <button
      type="button"
      onClick={onCalculate}
      className="min-h-14 w-full rounded-[24px] px-5 text-sm font-black text-white transition active:scale-[0.99] sm:text-base"
      style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)', boxShadow: '0 18px 34px rgba(21,101,192,.28)' }}
    >
      Calcular
    </button>
  )
}
