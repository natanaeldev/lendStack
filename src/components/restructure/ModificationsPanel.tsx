'use client'
// ─── Modifications Panel ──────────────────────────────────────────────────────
// Section card rendered inside LoanDetailPanel.
// Shows active modification (if any), history list, and entry points to wizard.

import { useState, useEffect, useCallback } from 'react'
import {
  MOD_STATUS_CFG, MOD_TYPE_CFG,
  fmtDate, ACTIVE_STATUSES, TERMINAL_STATUSES,
  type LoanModification,
} from './shared'
import ModificationWizard  from './ModificationWizard'
import ModificationDetail  from './ModificationDetail'
import type { Currency }   from '@/lib/loan'

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  loanId: string
  loanStatus: string
  currency: Currency
  remainingBalance: number
  overdueInterest?: number
  unpaidInstallments?: Array<{ installmentNumber: number; dueDate: string; status: string }>
}

// ─── Allowed statuses for restructuring ──────────────────────────────────────
const RESTRUCTURABLE_STATUSES = ['active', 'delinquent', 'disbursed']

// ─── Component ────────────────────────────────────────────────────────────────
export default function ModificationsPanel({
  loanId, loanStatus, currency, remainingBalance,
  overdueInterest = 0, unpaidInstallments = [],
}: Props) {
  const [mods,        setMods]        = useState<LoanModification[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showWizard,  setShowWizard]  = useState(false)
  const [detailModId, setDetailModId] = useState<string | null>(null)

  const canRestructure = RESTRUCTURABLE_STATUSES.includes(loanStatus)
  const nextDueDate    = unpaidInstallments.find(i => i.status !== 'paid')?.dueDate
  const unpaidCount    = unpaidInstallments.filter(i => i.status !== 'paid').length

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/loans/${loanId}/modifications`)
      const data = await res.json()
      if (res.ok) setMods(data.modifications ?? [])
    } catch { /* silently ignore */ }
    finally { setLoading(false) }
  }, [loanId])

  useEffect(() => { load() }, [load])

  const activeMod   = mods.find(m => ACTIVE_STATUSES.includes(m.status))
  const historyMods = mods.filter(m => TERMINAL_STATUSES.includes(m.status))
  const hasOpen     = !!activeMod

  return (
    <>
      {/* ── Section card ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>

        {/* Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <span className="text-base">🔀</span>
          <h3 className="text-sm font-bold text-slate-700 flex-1">Reestructuración y Reprogramación</h3>
          {canRestructure && !hasOpen && (
            <button onClick={() => setShowWizard(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
              + Nueva
            </button>
          )}
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4">

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center h-20 text-slate-400">
              <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
            </div>
          )}

          {/* Not restructurable */}
          {!loading && !canRestructure && (
            <p className="text-sm text-slate-400 italic">
              Este préstamo no puede ser reestructurado en su estado actual
              ({loanStatus === 'paid_off' ? 'pagado' : loanStatus}).
            </p>
          )}

          {/* Active modification card */}
          {!loading && activeMod && (
            <ActiveModCard
              mod={activeMod}
              onView={() => setDetailModId(activeMod._id)}
            />
          )}

          {/* Empty state: can restructure, no history */}
          {!loading && canRestructure && !hasOpen && mods.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center">
              <p className="text-2xl mb-2">🔀</p>
              <p className="text-sm font-semibold text-slate-600">Sin modificaciones</p>
              <p className="text-xs text-slate-400 mt-0.5 mb-3">
                Podés reestructurar el préstamo cuando sea necesario
              </p>
              <button onClick={() => setShowWizard(true)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
                Crear modificación
              </button>
            </div>
          )}

          {/* History list */}
          {!loading && historyMods.length > 0 && (
            <div className="space-y-2">
              {!activeMod && canRestructure && (
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Historial</p>
                  <button onClick={() => setShowWizard(true)}
                    className="text-xs text-blue-600 font-semibold hover:underline">
                    + Nueva
                  </button>
                </div>
              )}
              {activeMod && (
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Historial</p>
              )}
              {historyMods.map(mod => (
                <HistoryRow key={mod._id} mod={mod} onView={() => setDetailModId(mod._id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Wizard modal ─────────────────────────────────────────────────── */}
      {showWizard && (
        <ModificationWizard
          loanId={loanId}
          currency={currency}
          remainingBalance={remainingBalance}
          overdueInterest={overdueInterest}
          unpaidCount={unpaidCount}
          nextDueDate={nextDueDate}
          installments={unpaidInstallments}
          onClose={() => setShowWizard(false)}
          onCreated={(modId) => {
            setShowWizard(false)
            setDetailModId(modId)
            load()
          }}
        />
      )}

      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      {detailModId && (
        <ModificationDetail
          loanId={loanId}
          modId={detailModId}
          currency={currency}
          onClose={() => setDetailModId(null)}
          onRefresh={load}
        />
      )}
    </>
  )
}

// ─── Active modification card ─────────────────────────────────────────────────
function ActiveModCard({ mod, onView }: { mod: LoanModification; onView: () => void }) {
  const typeCfg   = MOD_TYPE_CFG[mod.type]
  const statusCfg = MOD_STATUS_CFG[mod.status]

  return (
    <div className="rounded-xl border-2 p-4 cursor-pointer hover:shadow-sm transition-all"
      style={{ borderColor: statusCfg.border, background: statusCfg.bg }}
      onClick={onView}>
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{typeCfg.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-bold text-slate-800">{typeCfg.label}</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border"
              style={{ background: '#fff', color: statusCfg.color, borderColor: statusCfg.border }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.dot }} />
              {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-slate-600 line-clamp-2">{mod.submissionReason}</p>
          <p className="text-xs text-slate-400 mt-1">
            Mod. #{mod.sequenceNumber} · {fmtDate(mod.createdAt)}
          </p>
        </div>
        <span className="text-slate-300 text-lg flex-shrink-0">›</span>
      </div>

      {/* Quick simulation impact preview */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t" style={{ borderColor: statusCfg.border }}>
        {[
          { label: 'Cuotas', delta: mod.simulation.impact.deltaInstallments, isAmt: false },
          { label: 'Interés', delta: mod.simulation.impact.deltaTotalInterest, isAmt: true },
          { label: 'Cuota', delta: mod.simulation.impact.deltaPeriodicPayment, isAmt: true },
        ].map(item => {
          const pos = item.delta > 0
          const zero = Math.abs(item.delta) < 0.01
          return (
            <div key={item.label} className="text-center">
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
              <p className="text-xs font-bold font-mono mt-0.5" style={{ color: zero ? '#6B7280' : pos ? '#DC2626' : '#059669' }}>
                {zero ? 'Sin cambio' : item.isAmt
                  ? `${pos ? '+' : ''}${item.delta.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `${pos ? '+' : ''}${item.delta}`
                }
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── History row ─────────────────────────────────────────────────────────────
function HistoryRow({ mod, onView }: { mod: LoanModification; onView: () => void }) {
  const typeCfg   = MOD_TYPE_CFG[mod.type]
  const statusCfg = MOD_STATUS_CFG[mod.status]
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
      onClick={onView}>
      <span className="text-lg flex-shrink-0">{typeCfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{typeCfg.label}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ color: statusCfg.color, background: statusCfg.bg }}>
            {statusCfg.label}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Mod. #{mod.sequenceNumber} · {fmtDate(mod.createdAt)}
          {mod.bookedAt ? ` · Aplicado ${fmtDate(mod.bookedAt)}` : ''}
        </p>
      </div>
      <span className="text-slate-300 flex-shrink-0">›</span>
    </div>
  )
}
