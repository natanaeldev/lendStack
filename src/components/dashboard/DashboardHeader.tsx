'use client'

import PrimaryActionButton from '@/components/app-shell/PrimaryActionButton'

export default function DashboardHeader({ title, description, context, summary, onPrimaryAction }: { title: string; description: string; context: string; summary: string; onPrimaryAction: () => void }) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#071A3E_0%,#0D2B5E_54%,#1565C0_100%)] px-4 py-5 text-white shadow-[0_24px_60px_rgba(7,26,62,.28)] sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="break-words text-2xl font-black tracking-[-0.02em] text-white sm:text-[2rem]">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-blue-100 sm:text-[15px]">{description}</p>
        </div>
        <PrimaryActionButton label="Crear préstamo" onClick={onPrimaryAction} className="w-full sm:w-auto" />
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-[24px] border border-white/15 bg-white/10 p-4 backdrop-blur">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">Contexto operativo</p>
          <p className="mt-2 break-words text-lg font-black leading-tight text-white">{context}</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100">{summary}</p>
        </div>
        <div className="rounded-[24px] border border-white/15 bg-slate-950/20 p-4 backdrop-blur">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">Prioridad del día</p>
          <p className="mt-2 text-lg font-black leading-tight text-white">Cobranza, riesgo y seguimiento en una sola vista.</p>
          <p className="mt-3 text-sm leading-6 text-blue-100">Usa las alertas urgentes y las acciones rápidas para resolver lo crítico antes de salir de Inicio.</p>
        </div>
      </div>
    </section>
  )
}
