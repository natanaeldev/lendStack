'use client'

import { useEffect, useState } from 'react'
import type { LoanApproval, LoanAuditLog } from '@/lib/loanReauth/types'

interface ApprovalStatusPanelProps {
  loanId: string
}

type LoanApprovalInfo = LoanApproval & { approverName?: string | null }

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: '#FFF7ED', color: '#92400E', label: 'Pendiente' },
  approved: { bg: '#ECFDF5', color: '#064E3B', label: 'Aprobado' },
  rejected: { bg: '#FEF2F2', color: '#881337', label: 'Rechazado' },
  skipped:  { bg: '#F8FAFC', color: '#64748B', label: 'Omitido' },
}

const AUDIT_LABELS: Record<string, string> = {
  loan_created:            'Préstamo creado',
  threshold_exceeded:      'Umbral excedido',
  reauth_started:          'Reautorización iniciada',
  id_scan_submitted:       'Cédula enviada',
  id_scan_passed:          'Cédula verificada ✓',
  id_scan_failed:          'Cédula fallida ✗',
  biometric_submitted:     'Biometría enviada',
  biometric_passed:        'Biometría verificada ✓',
  biometric_failed:        'Biometría fallida ✗',
  reauth_completed:        'Reautorización completada ✓',
  reauth_failed:           'Reautorización fallida ✗',
  approval_request_created:'Aprobación solicitada',
  notification_sent:       'Notificación enviada',
  approval_task_approved:  'Tarea aprobada ✓',
  approval_task_rejected:  'Tarea rechazada ✗',
  loan_fully_approved:     'Préstamo aprobado ✓',
  loan_fully_rejected:     'Préstamo rechazado ✗',
  disbursement_unlocked:   'Desembolso desbloqueado ✓',
  disbursement_blocked:    'Desembolso bloqueado',
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export default function ApprovalStatusPanel({ loanId }: ApprovalStatusPanelProps) {
  const [approvals, setApprovals] = useState<LoanApprovalInfo[]>([])
  const [auditLogs, setAuditLogs] = useState<LoanAuditLog[]>([])
  const [loanInfo, setLoanInfo]   = useState<any>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/loans/${loanId}/approvals`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      setApprovals(data.approvals ?? [])
      setAuditLogs(data.auditLogs ?? [])
      setLoanInfo(data.loan ?? null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [loanId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-slate-500">
        Cargando estado de aprobación…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!loanInfo?.requiresReauth && !approvals.length) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {loanInfo?.reauthStatus && (
        <div
          className="rounded-2xl border p-4"
          style={
            loanInfo.approvalStatus === 'approved'
              ? { borderColor: '#86EFAC', background: '#F0FDF4' }
              : loanInfo.approvalStatus === 'rejected'
              ? { borderColor: '#FCA5A5', background: '#FEF2F2' }
              : { borderColor: '#C4B5FD', background: '#F5F3FF' }
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Estado de reautorización</p>
              <p className="mt-1 font-bold text-slate-900">{loanInfo.reauthStatus?.replace(/_/g, ' ')}</p>
            </div>
            {loanInfo.disbursementLocked && (
              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                Desembolso bloqueado
              </span>
            )}
            {!loanInfo.disbursementLocked && loanInfo.requiresReauth && (
              <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                Listo para desembolso
              </span>
            )}
          </div>
        </div>
      )}

      {/* Approval tasks */}
      {approvals.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Aprobadores</h3>
          <div className="space-y-2">
            {approvals.map((a, i) => {
              const style = STATUS_STYLES[a.status] ?? STATUS_STYLES.pending
              return (
                <div key={a._id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: a.status === 'approved' ? '#10B981' : a.status === 'rejected' ? '#EF4444' : '#94A3B8' }}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {a.approverName ?? `Aprobador (${a.approverRole})`}
                      </p>
                      <p className="text-xs text-slate-500">{a.approverRole}</p>
                      {a.comments && <p className="mt-0.5 text-xs italic text-slate-500">"{a.comments}"</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {style.label}
                    </span>
                    {a.decidedAt && (
                      <span className="text-[10px] text-slate-400">{fmtDate(a.decidedAt)}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Audit timeline */}
      {auditLogs.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Historial de eventos</h3>
          <div className="relative border-l-2 border-slate-100 pl-4 space-y-3">
            {auditLogs.map((log) => (
              <div key={log._id} className="relative">
                <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-300" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {AUDIT_LABELS[log.eventType] ?? log.eventType}
                  </p>
                  <p className="text-xs text-slate-400">{fmtDate(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
