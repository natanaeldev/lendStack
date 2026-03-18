'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AdminModuleHeader from '@/components/admin/AdminModuleHeader'
import type { LoanCreditPolicy } from '@/lib/loanPolicy/types'

// ─── Default values ───────────────────────────────────────────────────────────

const DEFAULT_RULES = {
  auto_approve:  { credit_score_gte: 720, debt_to_income_lte: 30, income_gte: 4000 },
  manual_review: { credit_score_gte: 650, debt_to_income_lte: 40, income_gte: 2500 },
  auto_reject:   { credit_score_lt:  650, debt_to_income_gt:  40, income_lt:  2500 },
}

// ─── Policy Form ──────────────────────────────────────────────────────────────

function PolicyForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing?: LoanCreditPolicy | null
  onSaved: () => void
  onCancel: () => void
}) {
  const [name, setName]                   = useState(existing?.policy_name              ?? 'Política de aprobación de préstamos')
  const [minCreditScore, setMinCS]        = useState(String(existing?.min_credit_score  ?? 650))
  const [maxDTI, setMaxDTI]               = useState(String(existing?.max_debt_to_income_ratio ?? 40))
  const [minIncome, setMinIncome]         = useState(String(existing?.min_monthly_income ?? 2500))
  const [maxAmount, setMaxAmount]         = useState(String(existing?.max_loan_amount   ?? 50000))
  const [employmentReq, setEmploymentReq] = useState(existing?.employment_required ?? true)
  const [isActive, setIsActive]           = useState(existing?.is_active ?? true)

  const [aaCS, setAaCS]   = useState(String(existing?.rules.auto_approve.credit_score_gte  ?? DEFAULT_RULES.auto_approve.credit_score_gte))
  const [aaDTI, setAaDTI] = useState(String(existing?.rules.auto_approve.debt_to_income_lte ?? DEFAULT_RULES.auto_approve.debt_to_income_lte))
  const [aaInc, setAaInc] = useState(String(existing?.rules.auto_approve.income_gte        ?? DEFAULT_RULES.auto_approve.income_gte))

  const [mrCS, setMrCS]   = useState(String(existing?.rules.manual_review.credit_score_gte  ?? DEFAULT_RULES.manual_review.credit_score_gte))
  const [mrDTI, setMrDTI] = useState(String(existing?.rules.manual_review.debt_to_income_lte ?? DEFAULT_RULES.manual_review.debt_to_income_lte))
  const [mrInc, setMrInc] = useState(String(existing?.rules.manual_review.income_gte        ?? DEFAULT_RULES.manual_review.income_gte))

  const [arCS, setArCS]   = useState(String(existing?.rules.auto_reject.credit_score_lt  ?? DEFAULT_RULES.auto_reject.credit_score_lt))
  const [arDTI, setArDTI] = useState(String(existing?.rules.auto_reject.debt_to_income_gt ?? DEFAULT_RULES.auto_reject.debt_to_income_gt))
  const [arInc, setArInc] = useState(String(existing?.rules.auto_reject.income_lt        ?? DEFAULT_RULES.auto_reject.income_lt))

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const inputCls = 'w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none'
  const labelCls = 'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1'

  async function save() {
    setError('')
    setSaving(true)
    try {
      const url    = existing ? `/api/admin/loan-policy/${existing._id}` : '/api/admin/loan-policy'
      const method = existing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy_name:              name,
          min_credit_score:         Number(minCreditScore),
          max_debt_to_income_ratio: Number(maxDTI),
          min_monthly_income:       Number(minIncome),
          max_loan_amount:          Number(maxAmount),
          employment_required:      employmentReq,
          is_active:                isActive,
          rules: {
            auto_approve:  { credit_score_gte: Number(aaCS),  debt_to_income_lte: Number(aaDTI), income_gte: Number(aaInc) },
            manual_review: { credit_score_gte: Number(mrCS),  debt_to_income_lte: Number(mrDTI), income_gte: Number(mrInc) },
            auto_reject:   { credit_score_lt:  Number(arCS),  debt_to_income_gt:  Number(arDTI), income_lt:  Number(arInc) },
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error guardando')
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-[28px] border border-indigo-100 bg-white p-5 shadow-sm space-y-5">
      <h3 className="font-bold text-slate-900">{existing ? 'Editar política' : 'Nueva política'}</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Basic fields */}
      <div>
        <label className={labelCls}>Nombre de la política</label>
        <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Puntuación de crédito mínima</label>
          <input type="number" min={0} max={850} value={minCreditScore} onChange={e => setMinCS(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Relación deuda-ingresos máx. (%)</label>
          <input type="number" min={0} max={100} value={maxDTI} onChange={e => setMaxDTI(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Ingreso mensual mínimo</label>
          <input type="number" min={0} value={minIncome} onChange={e => setMinIncome(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Monto máximo de préstamo</label>
          <input type="number" min={1} value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={employmentReq} onChange={e => setEmploymentReq(e.target.checked)} />
          Empleo requerido
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
          Activa
        </label>
      </div>

      {/* Rules section */}
      <div className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Reglas de evaluación</p>

        {/* Auto-approve */}
        <div className="rounded-2xl border border-green-100 bg-green-50 p-4 space-y-3">
          <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Aprobación automática (todos deben cumplirse)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Puntuación crédito ≥</label>
              <input type="number" value={aaCS} onChange={e => setAaCS(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Deuda/ingresos ≤ (%)</label>
              <input type="number" value={aaDTI} onChange={e => setAaDTI(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ingreso ≥</label>
              <input type="number" value={aaInc} onChange={e => setAaInc(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Manual review */}
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 space-y-3">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Revisión manual (todos deben cumplirse)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Puntuación crédito ≥</label>
              <input type="number" value={mrCS} onChange={e => setMrCS(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Deuda/ingresos ≤ (%)</label>
              <input type="number" value={mrDTI} onChange={e => setMrDTI(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ingreso ≥</label>
              <input type="number" value={mrInc} onChange={e => setMrInc(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Auto-reject */}
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 space-y-3">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Rechazo automático (cualquiera activa el rechazo)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Puntuación crédito &lt;</label>
              <input type="number" value={arCS} onChange={e => setArCS(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Deuda/ingresos &gt; (%)</label>
              <input type="number" value={arDTI} onChange={e => setArDTI(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ingreso &lt;</label>
              <input type="number" value={arInc} onChange={e => setArInc(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">
          Cancelar
        </button>
        <button onClick={save} disabled={saving} className="flex-1 rounded-2xl bg-indigo-600 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LoanPolicyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [policies, setPolicies]   = useState<LoanCreditPolicy[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<LoanCreditPolicy | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') load()
  }, [status])

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/loan-policy')
      const data = await res.json()
      setPolicies(data.policies ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function deactivate(id: string) {
    await fetch(`/api/admin/loan-policy/${id}`, { method: 'DELETE' })
    load()
  }

  async function activate(id: string) {
    await fetch(`/api/admin/loan-policy/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    })
    load()
  }

  function openNew()  { setEditing(null);  setShowForm(true) }
  function openEdit(p: LoanCreditPolicy) { setEditing(p); setShowForm(true) }
  function afterSave() { setShowForm(false); setEditing(null); load() }
  function cancel()    { setShowForm(false); setEditing(null) }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminModuleHeader
        eyebrow="Configuración"
        title="Política de aprobación de crédito"
        description="Configura los criterios automáticos para evaluar solicitudes de préstamo"
      />

      <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        {!showForm && (
          <button onClick={openNew} className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white">
            + Nueva política de crédito
          </button>
        )}

        {showForm && (
          <PolicyForm existing={editing} onSaved={afterSave} onCancel={cancel} />
        )}

        {loading && <p className="text-center text-sm text-slate-400 py-8">Cargando…</p>}

        {!loading && policies.length === 0 && !showForm && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            No hay políticas configuradas. Crea una para empezar.
          </div>
        )}

        {policies.map(p => (
          <div
            key={p._id}
            className={`rounded-[28px] border bg-white p-5 shadow-sm space-y-3 ${
              p.is_active ? 'border-indigo-100' : 'border-slate-100 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900">{p.policy_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Creada {new Date(p.createdAt).toLocaleDateString('es-DO')}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                p.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {p.is_active ? 'Activa' : 'Inactiva'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
              <div className="rounded-xl bg-slate-50 p-2">
                <p className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">Crédito mín.</p>
                <p className="font-semibold mt-0.5">{p.min_credit_score}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <p className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">Deuda/ingreso máx.</p>
                <p className="font-semibold mt-0.5">{p.max_debt_to_income_ratio}%</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <p className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">Ingreso mín.</p>
                <p className="font-semibold mt-0.5">{p.min_monthly_income.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <p className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">Préstamo máx.</p>
                <p className="font-semibold mt-0.5">{p.max_loan_amount.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-green-50 border border-green-100 p-2 text-green-800">
                <p className="font-bold uppercase tracking-wide text-[10px] mb-1">Auto-aprobación</p>
                <p>Crédito ≥ {p.rules.auto_approve.credit_score_gte}</p>
                <p>Ingreso ≥ {p.rules.auto_approve.income_gte.toLocaleString()}</p>
                <p>D/I ≤ {p.rules.auto_approve.debt_to_income_lte}%</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-2 text-amber-800">
                <p className="font-bold uppercase tracking-wide text-[10px] mb-1">Revisión manual</p>
                <p>Crédito ≥ {p.rules.manual_review.credit_score_gte}</p>
                <p>Ingreso ≥ {p.rules.manual_review.income_gte.toLocaleString()}</p>
                <p>D/I ≤ {p.rules.manual_review.debt_to_income_lte}%</p>
              </div>
              <div className="rounded-xl bg-red-50 border border-red-100 p-2 text-red-800">
                <p className="font-bold uppercase tracking-wide text-[10px] mb-1">Rechazo auto.</p>
                <p>Crédito &lt; {p.rules.auto_reject.credit_score_lt}</p>
                <p>Ingreso &lt; {p.rules.auto_reject.income_lt.toLocaleString()}</p>
                <p>D/I &gt; {p.rules.auto_reject.debt_to_income_gt}%</p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => openEdit(p)}
                className="flex-1 rounded-2xl border border-slate-200 py-2 text-xs font-semibold text-slate-600"
              >
                Editar
              </button>
              {p.is_active ? (
                <button
                  onClick={() => deactivate(p._id)}
                  className="flex-1 rounded-2xl border border-red-100 py-2 text-xs font-semibold text-red-600"
                >
                  Desactivar
                </button>
              ) : (
                <button
                  onClick={() => activate(p._id)}
                  className="flex-1 rounded-2xl border border-green-100 py-2 text-xs font-semibold text-green-700"
                >
                  Activar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
