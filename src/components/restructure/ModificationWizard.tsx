'use client'
import { useState } from 'react'
import { showToast } from '@/components/Toast'
import {
  inputCls, fmtDate, fmt, deltaLabel,
  MOD_TYPE_CFG, MOD_STATUS_CFG,
  type ModificationType, type SimulationResult,
  type InstallmentChange, type InstallmentSnapshot,
} from './shared'
import type { Currency } from '@/lib/loan'

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  loanId: string
  currency: Currency
  remainingBalance: number
  overdueInterest?: number          // pre-filled from delinquency
  unpaidCount?: number              // pre-filled from installments
  nextDueDate?: string              // pre-filled from first unpaid installment
  installments?: Array<{ installmentNumber: number; dueDate: string; status: string }>
  onClose: () => void
  onCreated: (modId: string) => void
}

type Step = 'type' | 'params' | 'simulate' | 'confirm'

// ─── All 7 modification types in order of frequency ──────────────────────────
const TYPE_ORDER: ModificationType[] = [
  'CAPITALIZE_ARREARS', 'TERM_EXTENSION', 'GRACE_PERIOD',
  'DUE_DATE_CHANGE', 'RATE_REDUCTION', 'INTEREST_ONLY_PERIOD', 'FULL_RESTRUCTURE',
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function ModificationWizard({
  loanId, currency, remainingBalance, overdueInterest = 0,
  unpaidCount = 0, nextDueDate, installments = [], onClose, onCreated,
}: Props) {
  const [step,           setStep]           = useState<Step>('type')
  const [selectedType,   setSelectedType]   = useState<ModificationType | null>(null)
  const [params,         setParams]         = useState<Record<string, any>>({})
  const [simulation,     setSimulation]     = useState<SimulationResult | null>(null)
  const [reason,         setReason]         = useState('')
  const [simulating,     setSimulating]     = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [savedModId,     setSavedModId]     = useState<string | null>(null)
  const [savedModStatus, setSavedModStatus] = useState<string | null>(null)
  const [simError,       setSimError]       = useState('')

  // ── Param initializers per type ──────────────────────────────────────────
  function initParams(type: ModificationType) {
    switch (type) {
      case 'DUE_DATE_CHANGE':
        return { installmentNumbers: [] as number[], newDueDates: [] as string[] }
      case 'TERM_EXTENSION':
        return { additionalInstallments: 6 }
      case 'GRACE_PERIOD':
        return { gracePeriodCount: 1, capitalizeInterest: false }
      case 'CAPITALIZE_ARREARS':
        return { overdueInterest, newInstallmentCount: unpaidCount || undefined }
      case 'RATE_REDUCTION':
        return { newRateValue: '', newRateUnit: 'DECIMAL' }
      case 'INTEREST_ONLY_PERIOD':
        return { interestOnlyCount: 3 }
      case 'FULL_RESTRUCTURE':
        return {
          newPrincipal: remainingBalance,
          newInterestMethod: 'DECLINING_BALANCE',
          newInstallmentCount: unpaidCount || 12,
          newPaymentFrequency: 'MONTHLY',
          newRateValue: '',
          newRateUnit: 'DECIMAL',
          newStartDate: nextDueDate ?? new Date().toISOString().slice(0, 10),
        }
      default: return {}
    }
  }

  function selectType(type: ModificationType) {
    setSelectedType(type)
    setParams(initParams(type))
    setSimulation(null)
    setSimError('')
    setStep('params')
  }

  // ── Build simulation input ────────────────────────────────────────────────
  function buildInput(): Record<string, any> | null {
    if (!selectedType) return null
    switch (selectedType) {
      case 'DUE_DATE_CHANGE': {
        const nums = params.installmentNumbers as number[]
        const dates = params.newDueDates as string[]
        if (!nums.length) { setSimError('Seleccioná al menos una cuota'); return null }
        if (dates.some(d => !d)) { setSimError('Especificá la nueva fecha para cada cuota'); return null }
        return { type: selectedType, installmentNumbers: nums, newDueDates: dates }
      }
      case 'TERM_EXTENSION': {
        const n = parseInt(params.additionalInstallments)
        if (!n || n < 1) { setSimError('Cantidad debe ser ≥ 1'); return null }
        return { type: selectedType, additionalInstallments: n }
      }
      case 'GRACE_PERIOD': {
        const n = parseInt(params.gracePeriodCount)
        if (!n || n < 1) { setSimError('Períodos debe ser ≥ 1'); return null }
        return { type: selectedType, gracePeriodCount: n, capitalizeInterest: !!params.capitalizeInterest }
      }
      case 'CAPITALIZE_ARREARS': {
        const oi = parseFloat(params.overdueInterest)
        if (isNaN(oi) || oi < 0) { setSimError('Mora inválida'); return null }
        const nc = params.newInstallmentCount ? parseInt(params.newInstallmentCount) : undefined
        return { type: selectedType, overdueInterest: oi, newInstallmentCount: nc }
      }
      case 'RATE_REDUCTION': {
        const rv = parseFloat(params.newRateValue)
        if (isNaN(rv) || rv <= 0) { setSimError('Tasa inválida'); return null }
        return { type: selectedType, newRateValue: rv, newRateUnit: params.newRateUnit }
      }
      case 'INTEREST_ONLY_PERIOD': {
        const n = parseInt(params.interestOnlyCount)
        if (!n || n < 1) { setSimError('Períodos debe ser ≥ 1'); return null }
        return { type: selectedType, interestOnlyCount: n }
      }
      case 'FULL_RESTRUCTURE': {
        const p = parseFloat(params.newPrincipal)
        const n = parseInt(params.newInstallmentCount)
        const rv = parseFloat(params.newRateValue)
        if (isNaN(p) || p <= 0)   { setSimError('Capital inválido'); return null }
        if (isNaN(n) || n < 1)    { setSimError('Cantidad de cuotas inválida'); return null }
        if (isNaN(rv) || rv <= 0) { setSimError('Tasa inválida'); return null }
        if (!params.newStartDate) { setSimError('Fecha de inicio requerida'); return null }
        return {
          type: selectedType,
          newPrincipal: p,
          newInterestMethod: params.newInterestMethod,
          newInstallmentCount: n,
          newPaymentFrequency: params.newPaymentFrequency,
          newRateValue: rv,
          newRateUnit: params.newRateUnit,
          newStartDate: params.newStartDate,
        }
      }
      default: return null
    }
  }

  async function runSimulation() {
    setSimError('')
    const input = buildInput()
    if (!input) return
    setSimulating(true)
    try {
      const res = await fetch(`/api/loans/${loanId}/modifications/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      const data = await res.json()
      if (!res.ok) { setSimError(data.error ?? 'Error en simulación'); return }
      setSimulation(data.simulation)
      setStep('simulate')
    } catch { setSimError('Error de red') }
    finally { setSimulating(false) }
  }

  async function saveAsDraft() {
    if (!reason.trim()) { showToast('Ingresá un motivo para la modificación', 'error'); return }
    setSaving(true)
    try {
      const input = buildInput()
      if (!input) return
      const res = await fetch(`/api/loans/${loanId}/modifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, submissionReason: reason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error ?? 'Error al guardar', 'error'); return }
      setSavedModId(data.modification._id)
      setSavedModStatus('DRAFT')
      setStep('confirm')
      showToast('Borrador guardado', 'success')
    } catch { showToast('Error de red', 'error') }
    finally { setSaving(false) }
  }

  async function submitForApproval() {
    if (!savedModId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/loans/${loanId}/modifications/${savedModId}/submit`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { showToast(data.error ?? 'Error al enviar', 'error'); return }
      setSavedModStatus('PENDING_APPROVAL')
      showToast('Enviado para aprobación', 'success')
    } catch { showToast('Error de red', 'error') }
    finally { setSubmitting(false) }
  }

  const stepTitles: Record<Step, string> = {
    type:     'Seleccionar tipo de modificación',
    params:   selectedType ? MOD_TYPE_CFG[selectedType].label : 'Parámetros',
    simulate: 'Resultado de simulación',
    confirm:  'Confirmar y enviar',
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[96vh] flex flex-col">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4 sm:hidden" />
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 flex-shrink-0">
              ×
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {step === 'type' ? 'Paso 1/4' : step === 'params' ? 'Paso 2/4' : step === 'simulate' ? 'Paso 3/4' : 'Paso 4/4'}
              </p>
              <h2 className="text-base font-bold text-slate-800 truncate">{stepTitles[step]}</h2>
            </div>
            {step !== 'type' && step !== 'confirm' && (
              <button onClick={() => setStep(step === 'simulate' ? 'params' : 'type')}
                className="text-xs text-blue-600 font-semibold hover:underline flex-shrink-0">
                ← Atrás
              </button>
            )}
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300"
              style={{
                width: step === 'type' ? '25%' : step === 'params' ? '50%' : step === 'simulate' ? '75%' : '100%',
                background: 'linear-gradient(90deg,#1565C0,#0D2B5E)',
              }} />
          </div>
        </div>

        {/* ── Body (scrollable) ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── STEP 1: Type selection ──────────────────────────────────── */}
          {step === 'type' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TYPE_ORDER.map(type => {
                const cfg = MOD_TYPE_CFG[type]
                return (
                  <button key={type} onClick={() => selectType(type)}
                    className="text-left p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all group">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{cfg.emoji}</span>
                      <div>
                        <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700">{cfg.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{cfg.desc}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* ── STEP 2: Params form ─────────────────────────────────────── */}
          {step === 'params' && selectedType && (
            <div className="space-y-4">
              <ParamsForm
                type={selectedType}
                params={params}
                setParams={setParams}
                installments={installments}
                remainingBalance={remainingBalance}
                currency={currency}
              />
              {simError && (
                <p className="text-sm px-4 py-2.5 rounded-xl"
                  style={{ background: '#FFF1F2', color: '#BE123C', border: '1.5px solid #FECDD3' }}>
                  {simError}
                </p>
              )}
              <button onClick={runSimulation} disabled={simulating}
                className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
                {simulating ? 'Simulando…' : 'Simular modificación →'}
              </button>
            </div>
          )}

          {/* ── STEP 3: Simulation results ──────────────────────────────── */}
          {step === 'simulate' && simulation && (
            <div className="space-y-4">
              <SimulationSummary simulation={simulation} currency={currency} />
              <InstallmentDiffTable changes={simulation.changes} currency={currency} />
              <button onClick={() => setStep('confirm')}
                className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
                Continuar →
              </button>
            </div>
          )}

          {/* ── STEP 4: Confirm ─────────────────────────────────────────── */}
          {step === 'confirm' && (
            <ConfirmStep
              savedModId={savedModId}
              savedModStatus={savedModStatus}
              simulation={simulation}
              reason={reason}
              setReason={setReason}
              currency={currency}
              saving={saving}
              submitting={submitting}
              saveAsDraft={saveAsDraft}
              submitForApproval={submitForApproval}
              onDone={() => { onCreated(savedModId!); onClose() }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Params form by type ──────────────────────────────────────────────────────
function ParamsForm({
  type, params, setParams, installments, remainingBalance, currency,
}: {
  type: ModificationType
  params: Record<string, any>
  setParams: (p: Record<string, any>) => void
  installments: Array<{ installmentNumber: number; dueDate: string; status: string }>
  remainingBalance: number
  currency: Currency
}) {
  const set = (key: string, val: any) => setParams({ ...params, [key]: val })
  const unpaid = installments.filter(i => i.status !== 'paid')

  switch (type) {
    case 'DUE_DATE_CHANGE': return (
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Cuotas a modificar</label>
        {unpaid.length === 0
          ? <p className="text-sm text-slate-400 italic">No hay cuotas pendientes</p>
          : unpaid.map(inst => {
            const selected = (params.installmentNumbers as number[]).includes(inst.installmentNumber)
            const idx = (params.installmentNumbers as number[]).indexOf(inst.installmentNumber)
            return (
              <div key={inst.installmentNumber} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200">
                <input type="checkbox" checked={selected} className="w-4 h-4 accent-blue-600"
                  onChange={e => {
                    const nums = [...params.installmentNumbers] as number[]
                    const dates = [...params.newDueDates] as string[]
                    if (e.target.checked) { nums.push(inst.installmentNumber); dates.push('') }
                    else { nums.splice(idx, 1); dates.splice(idx, 1) }
                    setParams({ ...params, installmentNumbers: nums, newDueDates: dates })
                  }} />
                <span className="text-sm text-slate-700 font-semibold">Cuota #{inst.installmentNumber}</span>
                <span className="text-xs text-slate-400">{inst.dueDate}</span>
                {selected && (
                  <input type="date" className={`${inputCls} ml-auto w-44`}
                    value={params.newDueDates[idx] ?? ''}
                    onChange={e => {
                      const dates = [...params.newDueDates] as string[]
                      dates[idx] = e.target.value
                      setParams({ ...params, newDueDates: dates })
                    }} />
                )}
              </div>
            )
          })}
      </div>
    )

    case 'TERM_EXTENSION': return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Cuotas adicionales a agregar
          </label>
          <input type="number" min={1} max={120} className={inputCls}
            value={params.additionalInstallments} onChange={e => set('additionalInstallments', e.target.value)} />
          <p className="text-xs text-slate-400 mt-1">Cuotas actuales pendientes: {unpaid.length}</p>
        </div>
      </div>
    )

    case 'GRACE_PERIOD': return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Períodos de gracia
          </label>
          <input type="number" min={1} max={24} className={inputCls}
            value={params.gracePeriodCount} onChange={e => set('gracePeriodCount', e.target.value)} />
        </div>
        <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 cursor-pointer hover:border-blue-300">
          <input type="checkbox" className="w-4 h-4 accent-blue-600"
            checked={params.capitalizeInterest}
            onChange={e => set('capitalizeInterest', e.target.checked)} />
          <div>
            <p className="text-sm font-semibold text-slate-700">Capitalizar interés</p>
            <p className="text-xs text-slate-400">El interés acumulado durante la gracia se suma al capital</p>
          </div>
        </label>
      </div>
    )

    case 'CAPITALIZE_ARREARS': return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Interés de mora a capitalizar ({currency})
          </label>
          <input type="number" min={0} step={0.01} className={inputCls}
            value={params.overdueInterest} onChange={e => set('overdueInterest', e.target.value)} />
          <p className="text-xs text-slate-400 mt-1">
            Nuevo capital estimado: {fmt(remainingBalance + (parseFloat(params.overdueInterest) || 0), currency)}
          </p>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Nueva cantidad de cuotas (opcional)
          </label>
          <input type="number" min={1} max={360} className={inputCls}
            placeholder={`Actual: ${unpaid.length}`}
            value={params.newInstallmentCount ?? ''} onChange={e => set('newInstallmentCount', e.target.value)} />
        </div>
      </div>
    )

    case 'RATE_REDUCTION': return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Nueva tasa
          </label>
          <div className="flex gap-2">
            <input type="number" min={0} step={0.0001} className={`${inputCls} flex-1`}
              placeholder="Ej: 0.02 ó 2"
              value={params.newRateValue} onChange={e => set('newRateValue', e.target.value)} />
            <select className={`${inputCls} w-32`}
              value={params.newRateUnit} onChange={e => set('newRateUnit', e.target.value)}>
              <option value="DECIMAL">Decimal</option>
              <option value="PERCENT">Porcentaje</option>
            </select>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {params.newRateUnit === 'PERCENT' ? 'Ejemplo: 2 = 2% por período' : 'Ejemplo: 0.02 = 2% por período'}
          </p>
        </div>
      </div>
    )

    case 'INTEREST_ONLY_PERIOD': return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Períodos de solo interés
          </label>
          <input type="number" min={1} max={36} className={inputCls}
            value={params.interestOnlyCount} onChange={e => set('interestOnlyCount', e.target.value)} />
          <p className="text-xs text-slate-400 mt-1">
            Durante este período no se amortiza capital, solo se paga interés.
          </p>
        </div>
      </div>
    )

    case 'FULL_RESTRUCTURE': return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nuevo capital</label>
            <input type="number" min={0} step={0.01} className={inputCls}
              value={params.newPrincipal} onChange={e => set('newPrincipal', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">N° de cuotas</label>
            <input type="number" min={1} max={360} className={inputCls}
              value={params.newInstallmentCount} onChange={e => set('newInstallmentCount', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tasa</label>
            <div className="flex gap-2">
              <input type="number" min={0} step={0.0001} className={`${inputCls} flex-1`}
                value={params.newRateValue} onChange={e => set('newRateValue', e.target.value)} />
              <select className={`${inputCls} w-28`}
                value={params.newRateUnit} onChange={e => set('newRateUnit', e.target.value)}>
                <option value="DECIMAL">Dec.</option>
                <option value="PERCENT">%</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Frecuencia</label>
            <select className={inputCls}
              value={params.newPaymentFrequency} onChange={e => set('newPaymentFrequency', e.target.value)}>
              <option value="MONTHLY">Mensual</option>
              <option value="BIWEEKLY">Quincenal</option>
              <option value="WEEKLY">Semanal</option>
              <option value="DAILY">Diario</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Método de interés</label>
            <select className={inputCls}
              value={params.newInterestMethod} onChange={e => set('newInterestMethod', e.target.value)}>
              <option value="DECLINING_BALANCE">Saldo decreciente</option>
              <option value="FLAT_TOTAL">Tasa plana total</option>
              <option value="FLAT_PER_PERIOD">Tasa plana por período</option>
              <option value="INTEREST_ONLY">Solo interés</option>
              <option value="ZERO_INTEREST">Sin interés</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha primera cuota</label>
            <input type="date" className={inputCls}
              value={params.newStartDate} onChange={e => set('newStartDate', e.target.value)} />
          </div>
        </div>
      </div>
    )

    default: return null
  }
}

// ─── Simulation summary card ───────────────────────────────────────────────────
function SimulationSummary({ simulation, currency }: { simulation: SimulationResult; currency: Currency }) {
  const { before, after, impact } = simulation
  const impactItems = [
    { label: 'Cuotas pendientes',  before: `${before.remainingInstallments}`, after: `${after.remainingInstallments}`, delta: impact.deltaInstallments, isAmount: false },
    { label: 'Capital pendiente',  before: fmt(before.remainingPrincipal, currency), after: fmt(after.remainingPrincipal, currency), delta: impact.deltaRemainingPrincipal, isAmount: true },
    { label: 'Interés restante',   before: fmt(before.totalRemainingInterest, currency), after: fmt(after.totalRemainingInterest, currency), delta: impact.deltaTotalInterest, isAmount: true },
    { label: 'Total a pagar',      before: fmt(before.totalRemainingPayable, currency), after: fmt(after.totalRemainingPayable, currency), delta: impact.deltaTotalPayable, isAmount: true },
    { label: 'Cuota periódica',    before: fmt(before.periodicPayment, currency), after: fmt(after.periodicPayment, currency), delta: impact.deltaPeriodicPayment, isAmount: true },
    { label: 'Fecha fin',          before: fmtDate(before.lastDueDate), after: fmtDate(after.lastDueDate), delta: 0, isAmount: false, skipDelta: true },
  ]

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
        <span className="text-sm font-bold text-white">Antes vs. Después</span>
        <span className="text-xs text-blue-200">Simulación</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase">Métrica</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-400 uppercase">Antes</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-400 uppercase">Después</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-400 uppercase">Impacto</th>
            </tr>
          </thead>
          <tbody>
            {impactItems.map((row, i) => {
              const positive = row.delta > 0
              const zero = Math.abs(row.delta) < 0.005
              return (
                <tr key={i} className={`border-b border-slate-50 ${i % 2 === 1 ? 'bg-slate-50' : ''}`}>
                  <td className="px-4 py-2.5 text-slate-600 text-xs font-semibold">{row.label}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-500 text-xs">{row.before}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800 text-xs">{row.after}</td>
                  <td className="px-3 py-2.5 text-right text-xs font-mono">
                    {row.skipDelta ? '—' : zero ? (
                      <span className="text-slate-400">Sin cambio</span>
                    ) : (
                      <span style={{ color: positive ? '#DC2626' : '#059669' }}>
                        {row.isAmount ? deltaLabel(row.delta, currency) : deltaLabel(row.delta)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Installment diff table ───────────────────────────────────────────────────
function InstallmentDiffTable({ changes, currency }: { changes: InstallmentChange[]; currency: Currency }) {
  const [expanded, setExpanded] = useState(false)
  const visible = changes.filter(c => c.action !== 'KEEP')
  const display = expanded ? visible : visible.slice(0, 8)

  if (!visible.length) return null

  const actionLabel: Record<string, string> = {
    SUPERSEDE:  'Reemplazada',
    ADD:        'Nueva',
    SHIFT_DATE: 'Fecha movida',
  }
  const actionColor: Record<string, { color: string; bg: string }> = {
    SUPERSEDE:  { color: '#9A3412', bg: '#FFF7ED' },
    ADD:        { color: '#14532D', bg: '#F0FDF4' },
    SHIFT_DATE: { color: '#1E40AF', bg: '#EFF6FF' },
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <span className="text-sm font-semibold text-slate-700">Detalle de cambios en cuotas</span>
        <span className="text-xs text-slate-400">{visible.length} cuota(s) afectada(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[500px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-2 text-left font-semibold text-slate-400">#</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-400">Acción</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-400">Antes</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-400">Después</th>
            </tr>
          </thead>
          <tbody>
            {display.map((c, i) => {
              const cfg = actionColor[c.action] ?? actionColor.ADD
              return (
                <tr key={i} className="border-b border-slate-50" style={{ background: i % 2 === 1 ? '#f8fafc' : '#fff' }}>
                  <td className="px-4 py-2 font-semibold text-slate-600">
                    {c.before?.installmentNumber ?? c.after?.installmentNumber}
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ color: cfg.color, background: cfg.bg }}>{actionLabel[c.action]}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400">
                    {c.before ? `${fmtDate(c.before.dueDate)} · ${fmt(c.before.scheduledAmount, currency)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700 font-semibold">
                    {c.after ? `${fmtDate(c.after.dueDate)} · ${fmt(c.after.scheduledAmount, currency)}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {visible.length > 8 && (
        <button onClick={() => setExpanded(!expanded)}
          className="w-full py-2 text-xs text-blue-600 font-semibold hover:bg-blue-50 border-t border-slate-100">
          {expanded ? 'Ver menos ↑' : `Ver ${visible.length - 8} más ↓`}
        </button>
      )}
    </div>
  )
}

// ─── Confirm step ─────────────────────────────────────────────────────────────
function ConfirmStep({
  savedModId, savedModStatus, simulation, reason, setReason, currency,
  saving, submitting, saveAsDraft, submitForApproval, onDone,
}: {
  savedModId: string | null
  savedModStatus: string | null
  simulation: SimulationResult | null
  reason: string
  setReason: (s: string) => void
  currency: Currency
  saving: boolean
  submitting: boolean
  saveAsDraft: () => void
  submitForApproval: () => void
  onDone: () => void
}) {
  if (savedModId && savedModStatus === 'PENDING_APPROVAL') {
    return (
      <div className="space-y-4 text-center py-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{ background: '#EFF6FF', border: '2px solid #BFDBFE' }}>
          <span className="text-3xl">✅</span>
        </div>
        <h3 className="text-lg font-bold text-slate-800">Enviado para aprobación</h3>
        <p className="text-sm text-slate-500">
          La modificación está en cola. Un usuario con rol de Manager deberá aprobarla antes de ser aplicada.
        </p>
        <button onClick={onDone}
          className="px-6 py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
          Ver modificación →
        </button>
      </div>
    )
  }

  if (savedModId) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl" style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC' }}>
          <p className="text-sm font-bold text-green-700">✓ Borrador guardado</p>
          <p className="text-xs text-green-600 mt-0.5">
            Podés enviar para aprobación ahora o hacerlo más tarde.
          </p>
        </div>
        {simulation && <SimulationSummary simulation={simulation} currency={currency} />}
        <div className="flex gap-3">
          <button onClick={onDone}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-600 border-2 border-slate-200 hover:bg-slate-50">
            Cerrar
          </button>
          <button onClick={submitForApproval} disabled={submitting}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
            {submitting ? 'Enviando…' : 'Enviar para aprobación'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {simulation && <SimulationSummary simulation={simulation} currency={currency} />}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
          Motivo de la modificación <span className="text-red-500">*</span>
        </label>
        <textarea rows={3} className={`${inputCls} resize-none`}
          placeholder="Ej: El cliente solicita extensión de plazo por dificultades temporales de pago…"
          value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      <button onClick={saveAsDraft} disabled={saving || !reason.trim()}
        className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
        {saving ? 'Guardando…' : 'Guardar borrador'}
      </button>
    </div>
  )
}
