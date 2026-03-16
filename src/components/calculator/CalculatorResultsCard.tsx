'use client'

export default function CalculatorResultsCard({
  installmentLabel,
  installmentValue,
  totalValue,
  interestValue,
  summary,
}: {
  installmentLabel: string
  installmentValue: string
  totalValue: string
  interestValue: string
  summary: string
}) {
  return (
    <div className="min-w-0 rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#071A3E_0%,#0D2B5E_100%)] p-4 text-white shadow-[0_24px_60px_rgba(7,26,62,.22)] sm:p-5">
      <p className="break-words text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">Resultado</p>
      <div className="mt-4 min-w-0 rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
        <p className="break-words text-xs font-bold uppercase tracking-[0.16em] text-blue-100">{installmentLabel}</p>
        <p className="mt-2 break-words whitespace-normal text-[clamp(1.8rem,7vw,2.5rem)] font-black leading-[1.05] text-white">{installmentValue}</p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-[22px] border border-white/10 bg-slate-950/20 p-4">
          <p className="break-words text-[11px] font-bold uppercase tracking-[0.16em] text-blue-100">Total a pagar</p>
          <p className="mt-2 break-words whitespace-normal text-base font-black leading-tight text-white sm:text-lg">{totalValue}</p>
        </div>
        <div className="min-w-0 rounded-[22px] border border-white/10 bg-slate-950/20 p-4">
          <p className="break-words text-[11px] font-bold uppercase tracking-[0.16em] text-blue-100">Interés total</p>
          <p className="mt-2 break-words whitespace-normal text-base font-black leading-tight text-white sm:text-lg">{interestValue}</p>
        </div>
      </div>
      <p className="mt-4 break-words whitespace-normal text-sm leading-6 text-blue-100">{summary}</p>
    </div>
  )
}
