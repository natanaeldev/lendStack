'use client'

import { useState } from 'react'
import { showToast } from '@/components/Toast'

// ─── Step Types ───────────────────────────────────────────────────────────────

type Step =
  | 'threshold_warning'
  | 'id_scan'
  | 'biometric'
  | 'result'
  | 'submit_approval'
  | 'done'

interface ReauthWizardProps {
  loanId: string
  amount: number
  currency: string
  thresholdAmount: number
  onComplete: () => void
  onCancel: () => void
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: 'threshold_warning', label: 'Advertencia' },
  { key: 'id_scan',           label: 'ID / Cédula' },
  { key: 'biometric',         label: 'Biometría' },
  { key: 'result',            label: 'Resultado' },
  { key: 'submit_approval',   label: 'Aprobación' },
]

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex(s => s.key === current)
  return (
    <div className="mb-6 flex items-center justify-between gap-1">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
            style={{
              background: i < currentIdx ? '#10B981' : i === currentIdx ? '#2563EB' : '#E2E8F0',
              color: i <= currentIdx ? '#fff' : '#94A3B8',
            }}
          >
            {i < currentIdx ? '✓' : i + 1}
          </div>
          <span className="hidden text-[10px] font-semibold text-slate-500 sm:block">{s.label}</span>
          {i < STEPS.length - 1 && (
            <div
              className="absolute hidden"
              style={{ left: '50%', top: '14px', right: '-50%', height: '2px', background: i < currentIdx ? '#10B981' : '#E2E8F0' }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReauthWizard({
  loanId,
  amount,
  currency,
  thresholdAmount,
  onComplete,
  onCancel,
}: ReauthWizardProps) {
  const [step, setStep] = useState<Step>('threshold_warning')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [idScanRef, setIdScanRef] = useState('')
  const [idScanPassed, setIdScanPassed] = useState<boolean | null>(null)
  const [bioType, setBioType]     = useState<'face' | 'fingerprint'>('face')
  const [bioRef, setBioRef]       = useState('')
  const [bioPassed, setBioPassed] = useState<boolean | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [finalSuccess, setFinalSuccess] = useState(false)

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)

  // ── Step: Threshold Warning ────────────────────────────────────────────────
  async function startSession() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/loans/${loanId}/reauth`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error iniciando sesión de reautorización')
      setSessionId(data.session._id)
      setStep('id_scan')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Step: ID Scan ─────────────────────────────────────────────────────────
  async function submitIdScan(passed: boolean) {
    if (!sessionId) return
    setLoading(true)
    setError('')
    try {
      const reference = idScanRef || `id-scan-${Date.now()}-${passed ? 'ok' : 'fail'}`
      const res = await fetch(`/api/loans/${loanId}/reauth/id-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, scanReference: reference, passed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error procesando escaneo de cédula')
      setIdScanPassed(passed)
      if (passed) {
        setStep('biometric')
      } else {
        setRetryCount(c => c + 1)
        if (data.session?.status === 'failed') {
          setStep('result')
        }
        // else allow retry
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Step: Biometric ───────────────────────────────────────────────────────
  async function submitBiometric(passed: boolean) {
    if (!sessionId) return
    setLoading(true)
    setError('')
    try {
      const reference = bioRef || `bio-${bioType}-${Date.now()}-${passed ? 'ok' : 'fail'}`
      const res = await fetch(`/api/loans/${loanId}/reauth/biometric`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, biometricType: bioType, verificationReference: reference, passed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error procesando verificación biométrica')
      setBioPassed(passed)
      if (passed) {
        await finalizeSession()
      } else {
        setRetryCount(c => c + 1)
        if (data.session?.status === 'failed') {
          setStep('result')
        }
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function finalizeSession() {
    if (!sessionId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/loans/${loanId}/reauth/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error finalizando sesión')
      setFinalSuccess(true)
      setStep('result')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Step: Submit for Approval ─────────────────────────────────────────────
  async function submitForApproval() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/loans/${loanId}/reauth/submit-approval`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error enviando para aprobación')
      showToast('Préstamo enviado para aprobación', 'success')
      setStep('done')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Reautorización requerida</h2>
            <p className="mt-1 text-sm text-slate-500">
              El monto excede el umbral configurado de {fmt(thresholdAmount)}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <StepIndicator current={step} />

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Step: Threshold Warning ────────────────────────────────────── */}
        {step === 'threshold_warning' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-800">⚠ Monto superior al umbral autorizado</p>
              <p className="mt-2 text-sm text-amber-700">
                El monto solicitado de <strong>{fmt(amount)}</strong> supera el umbral de{' '}
                <strong>{fmt(thresholdAmount)}</strong> permitido para este agente.
              </p>
              <p className="mt-2 text-sm text-amber-700">
                Para proceder, el cliente debe completar:
              </p>
              <ul className="ml-4 mt-1 list-disc text-sm text-amber-700">
                <li>Verificación de identidad (cédula / ID)</li>
                <li>Verificación biométrica (Face ID o huella)</li>
              </ul>
              <p className="mt-2 text-sm text-amber-700">
                Luego, el préstamo pasará a revisión de un aprobador antes de ser desembolsado.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                onClick={startSession}
                disabled={loading}
                className="flex-1 rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {loading ? 'Iniciando…' : 'Iniciar reautorización'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step: ID Scan ──────────────────────────────────────────────── */}
        {step === 'id_scan' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="font-semibold text-blue-800">Paso 1 — Escanear cédula / ID del cliente</p>
              <p className="mt-1 text-sm text-blue-700">
                Solicite al cliente que presente su documento de identidad y capture la imagen.
              </p>
            </div>
            {retryCount > 0 && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                Intento {retryCount} fallido. Por favor reintente con el documento correcto.
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700">Referencia del escaneo</label>
              <input
                type="text"
                value={idScanRef}
                onChange={e => setIdScanRef(e.target.value)}
                placeholder="ID del archivo o referencia del sistema"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">Ingrese la referencia del archivo capturado por su dispositivo.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => submitIdScan(false)}
                disabled={loading}
                className="rounded-2xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
              >
                {loading ? '…' : 'Falló'}
              </button>
              <button
                onClick={() => submitIdScan(true)}
                disabled={loading || !idScanRef}
                className="rounded-2xl bg-green-600 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {loading ? '…' : 'Verificado ✓'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Biometric ────────────────────────────────────────────── */}
        {step === 'biometric' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="font-semibold text-blue-800">Paso 2 — Verificación biométrica</p>
              <p className="mt-1 text-sm text-blue-700">
                Complete la verificación biométrica del cliente.
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">Método biométrico</label>
              <div className="mt-2 flex gap-3">
                {(['face', 'fingerprint'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setBioType(type)}
                    className="flex-1 rounded-2xl border py-2.5 text-sm font-semibold"
                    style={{
                      borderColor: bioType === type ? '#2563EB' : '#E2E8F0',
                      background:  bioType === type ? '#EFF6FF' : '#FAFAFA',
                      color:       bioType === type ? '#1D4ED8' : '#64748B',
                    }}
                  >
                    {type === 'face' ? '👤 Face ID' : '👆 Huella'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">Referencia del proveedor</label>
              <input
                type="text"
                value={bioRef}
                onChange={e => setBioRef(e.target.value)}
                placeholder="Token / referencia del proveedor biométrico"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            {retryCount > 0 && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                Intento {retryCount} fallido. Por favor reintente.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => submitBiometric(false)}
                disabled={loading}
                className="rounded-2xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
              >
                {loading ? '…' : 'Falló'}
              </button>
              <button
                onClick={() => submitBiometric(true)}
                disabled={loading || !bioRef}
                className="rounded-2xl bg-green-600 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {loading ? '…' : 'Verificado ✓'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Result ───────────────────────────────────────────────── */}
        {step === 'result' && (
          <div className="space-y-4">
            {finalSuccess ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
                <p className="text-lg font-bold text-green-800">Reautorización completada</p>
                <p className="mt-1 text-sm text-green-700">
                  La identidad y biometría del cliente fueron verificadas exitosamente.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">✗</div>
                <p className="text-lg font-bold text-red-800">Reautorización fallida</p>
                <p className="mt-1 text-sm text-red-700">
                  Se excedió el límite de intentos. El préstamo no puede continuar en este momento.
                </p>
              </div>
            )}
            {finalSuccess && (
              <button
                onClick={() => setStep('submit_approval')}
                className="w-full rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white"
              >
                Enviar para aprobación →
              </button>
            )}
            {!finalSuccess && (
              <button
                onClick={onCancel}
                className="w-full rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600"
              >
                Cerrar
              </button>
            )}
          </div>
        )}

        {/* ── Step: Submit Approval ──────────────────────────────────────── */}
        {step === 'submit_approval' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
              <p className="font-semibold text-violet-800">Paso final — Enviar para aprobación</p>
              <p className="mt-1 text-sm text-violet-700">
                La reautorización fue exitosa. El préstamo será enviado a los aprobadores designados.
                El desembolso quedará bloqueado hasta recibir todas las aprobaciones requeridas.
              </p>
            </div>
            <button
              onClick={submitForApproval}
              disabled={loading}
              className="w-full rounded-2xl bg-violet-600 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {loading ? 'Enviando…' : 'Enviar para aprobación'}
            </button>
          </div>
        )}

        {/* ── Step: Done ─────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">🎉</div>
              <p className="text-lg font-bold text-green-800">¡Enviado para aprobación!</p>
              <p className="mt-1 text-sm text-green-700">
                Los aprobadores han sido notificados. El préstamo avanzará una vez aprobado.
              </p>
            </div>
            <button
              onClick={onComplete}
              className="w-full rounded-2xl bg-green-600 py-3 text-sm font-bold text-white"
            >
              Continuar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
