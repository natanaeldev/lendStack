'use client'
import { useState, useEffect } from 'react'
import { useSession }          from 'next-auth/react'
import { showToast }           from '@/components/Toast'
import {
  MOD_STATUS_CFG, MOD_TYPE_CFG, AUDIT_ACTION_LABELS,
  fmt, fmtDate, fmtDateTime, deltaLabel, inputCls,
  ACTIVE_STATUSES,
  type LoanModification, type ModificationAuditEntry,
  type ScheduleVersion, type InstallmentChange,
} from './shared'
import type { Currency } from '@/lib/loan'

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  loanId: string
  modId: string
  currency: Currency
  onClose: () => void
  onRefresh: () => void
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'diff' | 'audit' | 'versions'

// ─── Component ────────────────────────────────────────────────────────────────
export default function ModificationDetail({ loanId, modId, currency, onClose, onRefresh }: Props) {
  const { data: session } = useSession()
  const isManager = session?.user?.role === 'master'
    || session?.user?.isOrganizationOwner
    || (session?.user as any)?.organizationRole === 'MANAGER'

  const [tab,        setTab]        = useState<Tab>('overview')
  const [mod,        setMod]        = useState<LoanModification | null>(null)
  const [audit,      setAudit]      = useState<ModificationAuditEntry[]>([])
  const [versions,   setVersions]   = useState<ScheduleVersion[]>([])
  const [loading,    setLoading]    = useState(true)
  const [actioning,  setActioning]  = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [modRes, auditRes] = await Promise.all([
        fetch(`/api/loans/${loanId}/modifications/${modId}`),
        fetch(`/api/loans/${loanId}/modifications/${modId}/audit`),
      ])
      const [modData, auditData] = await Promise.all([modRes.json(), auditRes.json()])
      if (modRes.ok) setMod(modData.modification)
      if (auditRes.ok) setAudit(auditData.auditTrail ?? [])
    } catch { showToast('Error al cargar', 'error') }
    finally { setLoading(false) }
  }

  async function loadVersions() {
    const res = await fetch(`/api/loans/${loanId}/schedule-versions`)
    const data = await res.json()
    if (res.ok) setVersions(data.versions ?? [])
  }

  useEffect(() => { load() }, [modId])
  useEffect(() => { if (tab === 'versions') loadVersions() }, [tab])

  async function action(endpoint: string, body?: Record<string, unknown>) {
    setActioning(true)
    try {
      const res = await fetch(`/api/loans/${loanId}/modifications/${modId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error ?? 'Error', 'error'); return }
      showToast('Acción completada', 'success')
      await load()
      onRefresh()
    } catch { showToast('Error de red', 'error') }
    finally { setActioning(false) }
  }

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 text-center">
        <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    </div>
  )

  if (!mod) return null

  const typeCfg   = MOD_TYPE_CFG[mod.type]
  const statusCfg = MOD_STATUS_CFG[mod.status]
  const isActive  = ACTIVE_STATUSES.includes(mod.status)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[96vh] flex flex-col">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4 sm:hidden" />
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl flex-shrink-0">{typeCfg.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <h2 className="text-base font-bold text-slate-800">{typeCfg.label}</h2>
                <StatusBadge status={mod.status} />
              </div>
              <p className="text-xs text-slate-400">
                Mod. #{mod.sequenceNumber} · Creado {fmtDate(mod.createdAt)}
              </p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 flex-shrink-0">
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-transparent -mb-px overflow-x-auto">
            {([
              { id: 'overview', label: 'Resumen' },
              { id: 'diff',     label: 'Cambios' },
              { id: 'audit',    label: `Auditoría (${audit.length})` },
              { id: 'versions', label: 'Versiones' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id as Tab)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-all -mb-px"
                style={{
                  borderBottomColor: tab === t.id ? '#1565C0' : 'transparent',
                  color: tab === t.id ? '#1565C0' : '#64748b',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* OVERVIEW tab */}
          {tab === 'overview' && (
            <>
              {/* Motivo */}
              <div className="rounded-xl p-3 bg-slate-50 border border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Motivo</p>
                <p className="text-sm text-slate-700">{mod.submissionReason}</p>
              </div>

              {/* Eligibility */}
              {!mod.eligibilitySnapshot.eligible && (
                <div className="rounded-xl p-3" style={{ background: '#FFF7ED', border: '1px solid #FDBA74' }}>
                  <p className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-2">⚠️ Advertencias de política</p>
                  <ul className="space-y-1">
                    {mod.eligibilitySnapshot.violations.map((v, i) => (
                      <li key={i} className="text-xs text-orange-800">· {v.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Simulation before/after */}
              <SimulationCard simulation={mod.simulation} currency={currency} />

              {/* Workflow timeline */}
              <WorkflowTimeline mod={mod} audit={audit} />

              {/* Action buttons */}
              {isActive && (
                <ActionBar
                  mod={mod} isManager={isManager} actioning={actioning}
                  showReject={showReject} setShowReject={setShowReject}
                  rejectReason={rejectReason} setRejectReason={setRejectReason}
                  onAction={action}
                />
              )}

              {/* Review notes */}
              {mod.reviewNotes && (
                <div className="rounded-xl p-3 bg-slate-50 border border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nota del revisor</p>
                  <p className="text-sm text-slate-700 italic">"{mod.reviewNotes}"</p>
                </div>
              )}
            </>
          )}

          {/* DIFF tab */}
          {tab === 'diff' && (
            <FullDiffTable changes={mod.simulation.changes} currency={currency} />
          )}

          {/* AUDIT tab */}
          {tab === 'audit' && (
            <AuditLog entries={audit} />
          )}

          {/* VERSIONS tab */}
          {tab === 'versions' && (
            <VersionsPanel versions={versions} currency={currency} targetVersion={mod.targetVersionNumber} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: LoanModification['status'] }) {
  const cfg = MOD_STATUS_CFG[status]
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border"
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

// ─── Simulation card (compact) ────────────────────────────────────────────────
function SimulationCard({ simulation, currency }: { simulation: LoanModification['simulation']; currency: Currency }) {
  const { before, after, impact } = simulation
  const rows = [
    { label: 'Cuotas', before: `${before.remainingInstallments}`, after: `${after.remainingInstallments}`, delta: impact.deltaInstallments, isAmt: false },
    { label: 'Capital', before: fmt(before.remainingPrincipal, currency), after: fmt(after.remainingPrincipal, currency), delta: impact.deltaRemainingPrincipal, isAmt: true },
    { label: 'Total pagar', before: fmt(before.totalRemainingPayable, currency), after: fmt(after.totalRemainingPayable, currency), delta: impact.deltaTotalPayable, isAmt: true },
    { label: 'Cuota', before: fmt(before.periodicPayment, currency), after: fmt(after.periodicPayment, currency), delta: impact.deltaPeriodicPayment, isAmt: true },
  ]
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100"
        style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Simulación</span>
        <span className="text-xs text-slate-400">{fmtDateTime(simulation.simulatedAt)}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
        {rows.map((row, i) => {
          const pos = row.delta > 0; const zero = Math.abs(row.delta) < 0.01
          return (
            <div key={i} className="p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{row.label}</p>
              <p className="text-xs font-mono text-slate-400 line-through">{row.before}</p>
              <p className="text-sm font-bold font-mono text-slate-800">{row.after}</p>
              {!zero && (
                <p className="text-[10px] font-mono mt-0.5"
                  style={{ color: pos ? '#DC2626' : '#059669' }}>
                  {row.isAmt ? deltaLabel(row.delta, currency) : deltaLabel(row.delta)}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Workflow timeline ────────────────────────────────────────────────────────
function WorkflowTimeline({ mod, audit }: { mod: LoanModification; audit: ModificationAuditEntry[] }) {
  const steps: Array<{ action: string; label: string; ts?: string; actor?: string; done: boolean }> = [
    { action: 'DRAFT_CREATED',  label: 'Creado',               ts: mod.createdAt,   actor: undefined,       done: true },
    { action: 'SUBMITTED',      label: 'Enviado',               ts: mod.submittedAt, actor: mod.submittedBy, done: !!mod.submittedAt },
    { action: 'APPROVED',       label: 'Aprobado',              ts: mod.reviewedAt,  actor: mod.reviewedBy,  done: mod.status === 'APPROVED' || mod.status === 'BOOKED' },
    { action: 'BOOKED',         label: 'Aplicado',              ts: mod.bookedAt,    actor: mod.bookedBy,    done: mod.status === 'BOOKED' },
  ]
  const isRejected  = mod.status === 'REJECTED'
  const isCancelled = mod.status === 'CANCELLED'

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Flujo de aprobación</p>
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {steps.map((step, i) => (
          <div key={step.action} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1" style={{ minWidth: 72 }}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                step.done ? 'text-white border-green-500' : 'text-slate-400 border-slate-200 bg-white'
              }`} style={step.done ? { background: '#16A34A' } : {}}>
                {step.done ? '✓' : i + 1}
              </div>
              <p className="text-[10px] font-semibold text-center text-slate-500">{step.label}</p>
              {step.ts && <p className="text-[9px] text-slate-400 text-center">{fmtDate(step.ts)}</p>}
            </div>
            {i < steps.length - 1 && (
              <div className="h-0.5 w-8 mx-0.5 rounded flex-shrink-0"
                style={{ background: step.done ? '#16A34A' : '#E5E7EB' }} />
            )}
          </div>
        ))}
        {(isRejected || isCancelled) && (
          <>
            <div className="h-0.5 w-8 mx-0.5 rounded flex-shrink-0" style={{ background: '#E5E7EB' }} />
            <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 72 }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 text-white"
                style={{ background: isRejected ? '#DC2626' : '#6B7280', borderColor: isRejected ? '#DC2626' : '#6B7280' }}>
                ✕
              </div>
              <p className="text-[10px] font-semibold text-center" style={{ color: isRejected ? '#DC2626' : '#6B7280' }}>
                {isRejected ? 'Rechazado' : 'Cancelado'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Action bar ───────────────────────────────────────────────────────────────
function ActionBar({
  mod, isManager, actioning, showReject, setShowReject, rejectReason, setRejectReason, onAction,
}: {
  mod: LoanModification; isManager: boolean; actioning: boolean
  showReject: boolean; setShowReject: (v: boolean) => void
  rejectReason: string; setRejectReason: (v: string) => void
  onAction: (endpoint: string, body?: Record<string, unknown>) => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acciones disponibles</p>
      <div className="flex flex-wrap gap-2">
        {mod.status === 'DRAFT' && (
          <button onClick={() => onAction('submit')} disabled={actioning}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
            {actioning ? '…' : 'Enviar para aprobación'}
          </button>
        )}
        {mod.status === 'PENDING_APPROVAL' && isManager && (
          <>
            <button onClick={() => onAction('approve')} disabled={actioning}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
              {actioning ? '…' : 'Aprobar'}
            </button>
            <button onClick={() => setShowReject(!showReject)} disabled={actioning}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)' }}>
              Rechazar
            </button>
          </>
        )}
        {mod.status === 'APPROVED' && isManager && (
          <button onClick={() => {
            if (confirm('¿Aplicar esta modificación al préstamo? Esta acción reemplazará las cuotas pendientes.')) {
              onAction('book')
            }
          }} disabled={actioning}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#2563EB,#1D4ED8)' }}>
            {actioning ? 'Aplicando…' : '⚡ Aplicar al préstamo'}
          </button>
        )}
        {(mod.status === 'DRAFT' || mod.status === 'PENDING_APPROVAL' || mod.status === 'APPROVED') && (
          <button onClick={() => onAction('cancel')} disabled={actioning}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 border-2 border-slate-200 hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
        )}
        {mod.status === 'PENDING_APPROVAL' && !isManager && (
          <p className="text-xs text-slate-400 italic self-center">
            Esperando aprobación de un Manager o superior.
          </p>
        )}
      </div>

      {/* Reject reason inline */}
      {showReject && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Motivo del rechazo</label>
          <textarea rows={2} className={`${inputCls} resize-none`}
            placeholder="Motivo requerido…"
            value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => setShowReject(false)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={() => onAction('reject', { reason: rejectReason })}
              disabled={actioning || !rejectReason.trim()}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)' }}>
              {actioning ? '…' : 'Confirmar rechazo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Full diff table ──────────────────────────────────────────────────────────
function FullDiffTable({ changes, currency }: { changes: InstallmentChange[]; currency: Currency }) {
  const all = changes
  const actionLabel: Record<string, string> = { SUPERSEDE: 'Reemplazada', ADD: 'Nueva', SHIFT_DATE: 'Fecha movida', KEEP: 'Sin cambio' }
  const actionBg: Record<string, string> = { SUPERSEDE: '#FFF7ED', ADD: '#F0FDF4', SHIFT_DATE: '#EFF6FF', KEEP: '#F9FAFB' }
  const actionColor: Record<string, string> = { SUPERSEDE: '#9A3412', ADD: '#14532D', SHIFT_DATE: '#1E40AF', KEEP: '#6B7280' }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <p className="text-sm font-semibold text-slate-700">Todas las cuotas afectadas</p>
        <p className="text-xs text-slate-400">{all.length} cuotas en total · {all.filter(c => c.action !== 'KEEP').length} modificadas</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[560px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-semibold uppercase">
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-right">Fecha antes</th>
              <th className="px-3 py-2 text-right">Monto antes</th>
              <th className="px-3 py-2 text-right">Fecha después</th>
              <th className="px-3 py-2 text-right">Monto después</th>
            </tr>
          </thead>
          <tbody>
            {all.map((c, i) => (
              <tr key={i} className="border-b border-slate-50" style={{ background: i % 2 === 1 ? '#f8fafc' : '#fff' }}>
                <td className="px-4 py-2 font-semibold text-slate-600">
                  {c.before?.installmentNumber ?? c.after?.installmentNumber}
                </td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ color: actionColor[c.action], background: actionBg[c.action] }}>
                    {actionLabel[c.action]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">{c.before ? fmtDate(c.before.dueDate) : '—'}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">{c.before ? fmt(c.before.scheduledAmount, currency) : '—'}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 font-semibold">{c.after ? fmtDate(c.after.dueDate) : '—'}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-800 font-bold">{c.after ? fmt(c.after.scheduledAmount, currency) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Audit log ────────────────────────────────────────────────────────────────
function AuditLog({ entries }: { entries: ModificationAuditEntry[] }) {
  if (!entries.length) return <p className="text-sm text-slate-400 italic">Sin entradas de auditoría</p>

  const actionColor: Record<string, { bg: string; color: string; emoji: string }> = {
    DRAFT_CREATED:    { bg: '#FFFBEB', color: '#92400E', emoji: '📝' },
    SUBMITTED:        { bg: '#EFF6FF', color: '#1E40AF', emoji: '📤' },
    APPROVED:         { bg: '#F0FDF4', color: '#14532D', emoji: '✅' },
    REJECTED:         { bg: '#FFF1F2', color: '#881337', emoji: '❌' },
    BOOKED:           { bg: '#EFF6FF', color: '#1E3A5F', emoji: '⚡' },
    CANCELLED:        { bg: '#F9FAFB', color: '#374151', emoji: '🚫' },
    CONSENT_RECORDED: { bg: '#F0FDF4', color: '#14532D', emoji: '📋' },
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => {
        const cfg = actionColor[entry.action] ?? { bg: '#F9FAFB', color: '#374151', emoji: '•' }
        return (
          <div key={entry._id ?? i} className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
              {cfg.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className="text-sm font-bold text-slate-700">
                  {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <span className="text-xs text-slate-400">{fmtDateTime(entry.timestamp)}</span>
              </div>
              <p className="text-xs text-slate-500">
                {entry.actorName} <span className="text-slate-400">({entry.actorRole})</span>
              </p>
              {(entry.reason || entry.notes) && (
                <p className="text-xs text-slate-400 mt-0.5 italic">
                  "{entry.reason ?? entry.notes}"
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Versions panel ───────────────────────────────────────────────────────────
function VersionsPanel({ versions, currency, targetVersion }: {
  versions: ScheduleVersion[]
  currency: Currency
  targetVersion: number
}) {
  const [selectedVersion, setSelectedVersion] = useState<ScheduleVersion | null>(null)

  if (!versions.length) {
    return (
      <div className="text-center py-12 rounded-xl border border-dashed border-slate-200">
        <p className="text-slate-400 text-sm">No hay versiones de cronograma aún.</p>
        <p className="text-slate-400 text-xs mt-1">Se crean cuando se aplica una modificación.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {versions.map(v => (
        <div key={v._id}
          className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${selectedVersion?._id === v._id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}
          onClick={() => setSelectedVersion(selectedVersion?._id === v._id ? null : v)}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: v.source === 'ORIGINAL' ? '#6B7280' : 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
                v{v.versionNumber}
              </span>
              <div>
                <p className="text-sm font-bold text-slate-700">
                  {v.source === 'ORIGINAL' ? 'Cronograma original' : `Modificación #${v.modificationId_sequence ?? '?'}`}
                </p>
                <p className="text-xs text-slate-400">{fmtDate(v.createdAt)}</p>
              </div>
            </div>
            {v.versionNumber === targetVersion && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                Esta modificación
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Cuotas', value: String(v.installmentCount) },
              { label: 'Capital', value: fmt(v.remainingPrincipal, currency) },
              { label: 'Total pagar', value: fmt(v.totalScheduledPayable, currency) },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-lg p-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">{item.label}</p>
                <p className="text-xs font-bold font-mono text-slate-700 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Expanded schedule */}
          {selectedVersion?._id === v._id && v.installments.length > 0 && (
            <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-xs min-w-[400px]">
                  <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                    <tr className="text-slate-400 font-semibold uppercase">
                      <th className="px-3 py-1.5 text-left">#</th>
                      <th className="px-3 py-1.5 text-right">Vencimiento</th>
                      <th className="px-3 py-1.5 text-right">Capital</th>
                      <th className="px-3 py-1.5 text-right">Interés</th>
                      <th className="px-3 py-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.installments.map((inst, ii) => (
                      <tr key={ii} className={`border-b border-slate-50 ${ii % 2 === 1 ? 'bg-slate-50' : ''}`}>
                        <td className="px-3 py-1.5 font-semibold text-slate-600">{inst.installmentNumber}</td>
                        <td className="px-3 py-1.5 text-right text-slate-500">{fmtDate(inst.dueDate)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmt(inst.scheduledPrincipal, currency)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmt(inst.scheduledInterest, currency)}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold">{fmt(inst.scheduledAmount, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
