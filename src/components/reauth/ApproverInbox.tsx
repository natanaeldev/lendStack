'use client'

import { useEffect, useState } from 'react'
import { showToast } from '@/components/Toast'

interface ApprovalTask {
  _id: string
  loanId: string
  approverRole: string
  status: string
  sequenceOrder: number
  createdAt: string
  loanAmount?: number
  loanCurrency?: string
  clientName?: string
}

interface LoanApprovalDetail {
  approval: ApprovalTask
  loanId: string
}

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

// ─── Decision Modal ───────────────────────────────────────────────────────────

function DecisionModal({
  task,
  onDecide,
  onClose,
}: {
  task: ApprovalTask
  onDecide: (action: 'approve' | 'reject', comments: string) => Promise<void>
  onClose: () => void
}) {
  const [action, setAction]   = useState<'approve' | 'reject' | null>(null)
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!action) return
    if (action === 'reject' && !comments.trim()) return
    setLoading(true)
    try {
      await onDecide(action, comments)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Decisión de aprobación</h3>
            <p className="text-sm text-slate-500">
              Préstamo de {task.clientName ?? '—'} por{' '}
              {task.loanAmount && task.loanCurrency ? fmt(task.loanAmount, task.loanCurrency) : '—'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        <div className="mb-4 flex gap-3">
          <button
            onClick={() => setAction('approve')}
            className="flex-1 rounded-2xl py-3 text-sm font-bold"
            style={{
              background: action === 'approve' ? '#ECFDF5' : '#F8FAFC',
              color:      action === 'approve' ? '#064E3B' : '#64748B',
              border:     action === 'approve' ? '1.5px solid #6EE7B7' : '1.5px solid #E2E8F0',
            }}
          >
            ✓ Aprobar
          </button>
          <button
            onClick={() => setAction('reject')}
            className="flex-1 rounded-2xl py-3 text-sm font-bold"
            style={{
              background: action === 'reject' ? '#FEF2F2' : '#F8FAFC',
              color:      action === 'reject' ? '#881337' : '#64748B',
              border:     action === 'reject' ? '1.5px solid #FCA5A5' : '1.5px solid #E2E8F0',
            }}
          >
            ✗ Rechazar
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700">
            Comentarios {action === 'reject' ? <span className="text-red-500">*</span> : <span className="text-slate-400">(opcional)</span>}
          </label>
          <textarea
            value={comments}
            onChange={e => setComments(e.target.value)}
            rows={3}
            placeholder={action === 'reject' ? 'Explique el motivo del rechazo…' : 'Comentarios adicionales…'}
            className="mt-1 w-full resize-none rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <button
          onClick={submit}
          disabled={!action || (action === 'reject' && !comments.trim()) || loading}
          className="w-full rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: action === 'reject' ? '#DC2626' : '#16A34A' }}
        >
          {loading ? 'Procesando…' : action === 'approve' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ApproverInbox() {
  const [tasks, setTasks]       = useState<ApprovalTask[]>([])
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState<ApprovalTask | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch('/api/approvals')
      const data = await res.json()
      setTasks(data.approvals ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleDecide(task: ApprovalTask, action: 'approve' | 'reject', comments: string) {
    const endpoint = `/api/loans/${task.loanId}/approvals/${task._id}/${action}`
    const res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ comments }),
    })
    const data = await res.json()
    if (!res.ok) {
      showToast(data.error ?? 'Error procesando decisión', 'error')
      throw new Error(data.error)
    }
    showToast(action === 'approve' ? 'Aprobación registrada' : 'Rechazo registrado', 'success')
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-slate-400">
        Cargando solicitudes de aprobación…
      </div>
    )
  }

  if (!tasks.length) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center">
        <p className="text-2xl">✓</p>
        <p className="mt-2 font-semibold text-slate-700">Sin aprobaciones pendientes</p>
        <p className="mt-1 text-sm text-slate-500">No tiene solicitudes de aprobación en este momento.</p>
      </div>
    )
  }

  return (
    <>
      {selected && (
        <DecisionModal
          task={selected}
          onDecide={(action, comments) => handleDecide(selected, action, comments)}
          onClose={() => setSelected(null)}
        />
      )}
      <div className="space-y-3">
        {tasks.map(task => (
          <div key={task._id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-bold text-slate-900">{task.clientName ?? '—'}</p>
              <p className="text-xs text-slate-500">
                {task.loanAmount && task.loanCurrency ? fmt(task.loanAmount, task.loanCurrency) : '—'}{' '}
                &middot; {task.approverRole} &middot; Solicitado {fmtDate(task.createdAt)}
              </p>
            </div>
            <button
              onClick={() => setSelected(task)}
              className="rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              Revisar
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
