'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AdminModuleHeader from '@/components/admin/AdminModuleHeader'
import type { LoanThresholdPolicy, LoanApprovalPolicy, ApproverDefinition } from '@/lib/loanReauth/types'
import {
  SCOPE_TYPE_LABELS, BIOMETRIC_MODE_LABELS, APPROVAL_MODE_LABELS,
} from '@/lib/loanReauth/types'

function ThresholdForm({
  onSaved,
  existing,
  onCancel,
}: {
  onSaved: () => void
  existing?: LoanThresholdPolicy | null
  onCancel: () => void
}) {
  const [scopeType, setScopeType] = useState(existing?.scopeType ?? 'global')
  const [scopeId, setScopeId] = useState(existing?.scopeId ?? '')
  const [amount, setAmount] = useState(String(existing?.thresholdAmount ?? ''))
  const [currency, setCurrency] = useState(existing?.currency ?? 'DOP')
  const [active, setActive] = useState(existing?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    setSaving(true)
    try {
      const url = existing ? `/api/admin/reauth-policies/threshold/${existing._id}` : '/api/admin/reauth-policies/threshold'
      const method = existing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeType, scopeId: scopeId || null, thresholdAmount: Number(amount), currency, active }),
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

  const inputCls = 'w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none'
  const labelCls = 'mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500'

  return (
    <div className="space-y-4 rounded-[28px] border border-blue-100 bg-white p-5 shadow-sm">
      <h3 className="font-bold text-slate-900">{existing ? 'Editar umbral' : 'Nuevo umbral'}</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Alcance</label>
          <select value={scopeType} onChange={(e) => setScopeType(e.target.value as any)} className={inputCls}>
            {Object.entries(SCOPE_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        {scopeType !== 'global' && (
          <div>
            <label className={labelCls}>ID de alcance</label>
            <input value={scopeId} onChange={(e) => setScopeId(e.target.value)} placeholder="ID sucursal / rol / usuario" className={inputCls} />
          </div>
        )}
        <div>
          <label className={labelCls}>Monto umbral</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="ej: 500000" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Moneda</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
            {['DOP', 'USD', 'EUR'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} id="threshold-active" />
        <label htmlFor="threshold-active" className="text-sm text-slate-700">Activo</label>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">Cancelar</button>
        <button onClick={save} disabled={saving} className="flex-1 rounded-2xl bg-blue-600 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

function ApproverDefinitionEditor({
  approvers,
  onChange,
}: {
  approvers: ApproverDefinition[]
  onChange: (a: ApproverDefinition[]) => void
}) {
  function addApprover() {
    onChange([...approvers, { type: 'manager' }])
  }

  function removeApprover(idx: number) {
    onChange(approvers.filter((_, i) => i !== idx))
  }

  function updateApprover(idx: number, patch: Partial<ApproverDefinition>) {
    onChange(approvers.map((a, i) => (i === idx ? { ...a, ...patch } : a)))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Aprobadores</label>
        <button onClick={addApprover} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">+ Agregar</button>
      </div>
      {approvers.map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={a.type}
            onChange={(e) => updateApprover(i, { type: e.target.value as ApproverDefinition['type'], value: undefined })}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="manager">Gerente</option>
            <option value="master">Maestro</option>
            <option value="custom_role">Rol personalizado</option>
            <option value="specific_user">Usuario específico</option>
          </select>
          {(a.type === 'custom_role' || a.type === 'specific_user') && (
            <input
              value={a.value ?? ''}
              onChange={(e) => updateApprover(i, { value: e.target.value })}
              placeholder={a.type === 'custom_role' ? 'Nombre del rol' : 'ID del usuario'}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          )}
          <button onClick={() => removeApprover(i)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      ))}
    </div>
  )
}

function ApprovalForm({
  onSaved,
  existing,
  onCancel,
}: {
  onSaved: () => void
  existing?: LoanApprovalPolicy | null
  onCancel: () => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [minAmount, setMinAmount] = useState(String(existing?.minAmount ?? '0'))
  const [maxAmount, setMaxAmount] = useState(existing?.maxAmount != null ? String(existing.maxAmount) : '')
  const [currency, setCurrency] = useState(existing?.currency ?? 'DOP')
  const [approvalMode, setApprovalMode] = useState(existing?.approvalMode ?? 'all_required')
  const [requiredCount, setRequiredCount] = useState(String(existing?.requiredApprovalCount ?? 1))
  const [rejectionMode, setRejectionMode] = useState(existing?.rejectionMode ?? 'terminal')
  const [biometricMode, setBiometricMode] = useState(existing?.biometricMode ?? 'either')
  const [retryLimit, setRetryLimit] = useState(String(existing?.retryLimit ?? 3))
  const [approvers, setApprovers] = useState<ApproverDefinition[]>(existing?.approvers ?? [{ type: 'manager' }])
  const [active, setActive] = useState(existing?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputCls = 'w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none'
  const labelCls = 'mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500'

  async function save() {
    setError('')
    setSaving(true)
    try {
      const url = existing ? `/api/admin/reauth-policies/approval/${existing._id}` : '/api/admin/reauth-policies/approval'
      const method = existing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          minAmount: Number(minAmount),
          maxAmount: maxAmount ? Number(maxAmount) : null,
          currency,
          approvalMode,
          requiredApprovalCount: Number(requiredCount),
          rejectionMode,
          biometricMode,
          retryLimit: Number(retryLimit),
          approvers,
          active,
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
    <div className="space-y-4 rounded-[28px] border border-violet-100 bg-white p-5 shadow-sm">
      <h3 className="font-bold text-slate-900">{existing ? 'Editar política de aprobación' : 'Nueva política de aprobación'}</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <label className={labelCls}>Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej: Aprobación alta gerencia" className={inputCls} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Monto mínimo</label>
          <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Monto máximo (vacío = sin límite)</label>
          <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Sin límite" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Moneda</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
            {['DOP', 'USD', 'EUR'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Modo de aprobación</label>
          <select value={approvalMode} onChange={(e) => setApprovalMode(e.target.value as any)} className={inputCls}>
            {Object.entries(APPROVAL_MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {approvalMode === 'minimum_count' && (
          <div>
            <label className={labelCls}>Mín. aprobaciones</label>
            <input type="number" min={1} value={requiredCount} onChange={(e) => setRequiredCount(e.target.value)} className={inputCls} />
          </div>
        )}
        <div>
          <label className={labelCls}>Modo de rechazo</label>
          <select value={rejectionMode} onChange={(e) => setRejectionMode(e.target.value as any)} className={inputCls}>
            <option value="terminal">Terminal (cualquier rechazo = rechazado)</option>
            <option value="majority">Mayoría</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Método biométrico</label>
          <select value={biometricMode} onChange={(e) => setBiometricMode(e.target.value as any)} className={inputCls}>
            {Object.entries(BIOMETRIC_MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Límite de reintentos biométricos</label>
          <input type="number" min={0} value={retryLimit} onChange={(e) => setRetryLimit(e.target.value)} className={inputCls} />
        </div>
      </div>
      <ApproverDefinitionEditor approvers={approvers} onChange={setApprovers} />
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} id="approval-active" />
        <label htmlFor="approval-active" className="text-sm text-slate-700">Activo</label>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">Cancelar</button>
        <button onClick={save} disabled={saving} className="flex-1 rounded-2xl bg-violet-600 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

export default function ReauthPoliciesContent() {
  const { status } = useSession()
  const router = useRouter()

  const [thresholds, setThresholds] = useState<LoanThresholdPolicy[]>([])
  const [approvalPolicies, setApprovals] = useState<LoanApprovalPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [showThresholdForm, setShowThresholdForm] = useState(false)
  const [showApprovalForm, setShowApprovalForm] = useState(false)
  const [editingThreshold, setEditingThreshold] = useState<LoanThresholdPolicy | null>(null)
  const [editingApproval, setEditingApproval] = useState<LoanApprovalPolicy | null>(null)
  const [tab, setTab] = useState<'threshold' | 'approval' | 'logs'>('threshold')
  const [logs, setLogs] = useState<any[]>([])

  async function loadAll() {
    setLoading(true)
    try {
      const [t, a] = await Promise.all([
        fetch('/api/admin/reauth-policies/threshold').then((r) => r.json()),
        fetch('/api/admin/reauth-policies/approval').then((r) => r.json()),
      ])
      setThresholds(t.policies ?? [])
      setApprovals(a.policies ?? [])
    } catch {
      // silent on purpose
    } finally {
      setLoading(false)
    }
  }

  async function loadLogs() {
    const res = await fetch('/api/admin/reauth-policies/audit-logs')
    const data = await res.json()
    setLogs(data.logs ?? [])
  }

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [router, status])

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (tab === 'logs') loadLogs()
  }, [tab])

  const tabCls = (active: boolean) => `rounded-full px-4 py-2 text-sm font-bold transition-colors ${active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`

  return (
    <div className="bg-slate-50 px-4 py-6 sm:px-8">
      <AdminModuleHeader
        eyebrow="Configuración"
        title="Políticas de reautorización"
        description="Configure umbrales de montos, flujos de aprobación multinivel y configuración biométrica para préstamos de alto monto."
      />

      <div className="mt-6 flex gap-2">
        <button onClick={() => setTab('threshold')} className={tabCls(tab === 'threshold')}>Umbrales</button>
        <button onClick={() => setTab('approval')} className={tabCls(tab === 'approval')}>Aprobaciones</button>
        <button onClick={() => setTab('logs')} className={tabCls(tab === 'logs')}>Historial</button>
      </div>

      <div className="mt-6 space-y-4">
        {tab === 'threshold' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Políticas de umbral ({thresholds.length})</p>
              <button
                onClick={() => { setEditingThreshold(null); setShowThresholdForm(true) }}
                className="rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white"
              >
                + Nuevo umbral
              </button>
            </div>
            {(showThresholdForm || editingThreshold) && (
              <ThresholdForm
                existing={editingThreshold}
                onSaved={() => { setShowThresholdForm(false); setEditingThreshold(null); loadAll() }}
                onCancel={() => { setShowThresholdForm(false); setEditingThreshold(null) }}
              />
            )}
            {loading ? (
              <p className="text-sm text-slate-400">Cargando…</p>
            ) : thresholds.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                No hay políticas de umbral configuradas. Las solicitudes de préstamo no requerirán reautorización.
              </div>
            ) : (
              <div className="space-y-2">
                {thresholds.map((t) => (
                  <div key={t._id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {SCOPE_TYPE_LABELS[t.scopeType]} {t.scopeId ? `— ${t.scopeId}` : ''}
                      </p>
                      <p className="text-xs text-slate-500">
                        Umbral: {new Intl.NumberFormat('es-DO', { style: 'currency', currency: t.currency }).format(t.thresholdAmount)} · {t.currency}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {t.active ? 'Activo' : 'Inactivo'}
                      </span>
                      <button
                        onClick={() => { setEditingThreshold(t); setShowThresholdForm(false) }}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'approval' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Políticas de aprobación ({approvalPolicies.length})</p>
              <button
                onClick={() => { setEditingApproval(null); setShowApprovalForm(true) }}
                className="rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white"
              >
                + Nueva política
              </button>
            </div>
            {(showApprovalForm || editingApproval) && (
              <ApprovalForm
                existing={editingApproval}
                onSaved={() => { setShowApprovalForm(false); setEditingApproval(null); loadAll() }}
                onCancel={() => { setShowApprovalForm(false); setEditingApproval(null) }}
              />
            )}
            {loading ? (
              <p className="text-sm text-slate-400">Cargando…</p>
            ) : approvalPolicies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                No hay políticas de aprobación configuradas.
              </div>
            ) : (
              <div className="space-y-2">
                {approvalPolicies.map((p) => (
                  <div key={p._id} className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500">
                          {new Intl.NumberFormat('es-DO', { style: 'currency', currency: p.currency }).format(p.minAmount)}
                          {p.maxAmount != null ? ` – ${new Intl.NumberFormat('es-DO', { style: 'currency', currency: p.currency }).format(p.maxAmount)}` : '+'}
                          {' '}
                          · {APPROVAL_MODE_LABELS[p.approvalMode]}
                          {' '}
                          · {BIOMETRIC_MODE_LABELS[p.biometricMode]}
                          {' '}
                          · {p.approvers.length} aprobador(es)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {p.active ? 'Activo' : 'Inactivo'}
                        </span>
                        <button
                          onClick={() => { setEditingApproval(p); setShowApprovalForm(false) }}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'logs' && (
          <>
            <p className="text-sm font-semibold text-slate-700">Historial de cambios en políticas</p>
            {logs.length === 0 ? (
              <p className="text-sm text-slate-400">Sin registros.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log: any) => (
                  <div key={log._id} className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold capitalize text-slate-800">{log.policyType} política</span>
                      <span className="text-xs text-slate-400">
                        {new Date(log.createdAt).toLocaleString('es-DO')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">ID: {log.policyId} · Por: {log.changedBy}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
