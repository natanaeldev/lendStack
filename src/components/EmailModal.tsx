'use client'
import { useState } from 'react'
import { LoanParams, LoanResult, RiskConfig, RISK_PROFILES, formatCurrency, formatPercent, Currency } from '@/lib/loan'

interface Props {
  isOpen:  boolean
  onClose: () => void
  params:  LoanParams
  result:  LoanResult
  config:  RiskConfig
}

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function EmailModal({ isOpen, onClose, params, result, config }: Props) {
  const [to,      setTo]      = useState('')
  const [message, setMessage] = useState('')
  const [status,  setStatus]  = useState<Status>('idle')

  if (!isOpen) return null

  const fmt = (v: number) => formatCurrency(v, params.currency)

  const handleSend = async () => {
    if (!to || !to.includes('@')) return
    setStatus('sending')

    const subject = `Cotización de préstamo – JVF Inversiones`
    const html = `
      <h2 style="color:#0D2B5E;font-family:sans-serif">Cotización de préstamo</h2>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;width:100%;max-width:420px">
        ${rows.map(([l, v]) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b">${l}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0D2B5E;text-align:right">${v}</td>
          </tr>`).join('')}
      </table>
      ${message ? `<p style="margin-top:16px;font-family:sans-serif;font-size:14px;color:#374151">${message}</p>` : ''}
      <p style="margin-top:24px;font-family:sans-serif;font-size:12px;color:#94a3b8">JVF Inversiones</p>
    `

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Error al enviar')
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  const handleClose = () => {
    setTo(''); setMessage(''); setStatus('idle'); onClose()
  }

  const rows = [
    ['Monto',         fmt(params.amount)],
    ['Plazo',         `${params.termYears} años (${result.totalMonths} meses)`],
    ['Perfil',        `${config.emoji} ${config.label}`],
    ['Tasa anual',    formatPercent(result.annualRate)],
    ['Cuota mensual', fmt(result.monthlyPayment)],
    ['Total a pagar', fmt(result.totalPayment)],
    ['Total interés', fmt(result.totalInterest)],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(7,26,62,.55)', backdropFilter: 'blur(4px)' }} onClick={handleClose}>
      <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl slide-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl" style={{ color: '#0D2B5E' }}>✉️ Enviar cotización</h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        {status !== 'sent' ? (
          <>
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Email del destinatario</label>
              <input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="cliente@email.com"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                style={{ color: '#374151' }} />
            </div>

            {/* Summary */}
            <div className="rounded-xl p-4 mb-4 border border-slate-200 bg-slate-50 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Resumen de cotización</p>
              {rows.map(([l, v]) => (
                <div key={l} className="flex justify-between text-xs border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-slate-500">{l}</span>
                  <span className="font-bold" style={{ color: '#0D2B5E' }}>{v}</span>
                </div>
              ))}
            </div>

            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Mensaje personalizado (opcional)</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                placeholder="Estimado/a cliente, le enviamos la cotización solicitada..."
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
                style={{ color: '#374151', fontFamily: "'DM Sans', sans-serif" }} />
            </div>

            {status === 'error' && (
              <p className="text-xs text-red-600 mb-3 text-center">⚠️ No se pudo enviar el correo. Verificá la dirección o intentá de nuevo.</p>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={handleClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={handleSend} disabled={status === 'sending' || !to.includes('@')}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                style={{ background: status === 'error' ? '#b91c1c' : '#2e7d32' }}>
                {status === 'sending' ? '⏳ Enviando...' : status === 'error' ? '🔄 Reintentar' : '📨 Enviar'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-base font-bold" style={{ color: '#0D2B5E' }}>¡Cotización enviada!</p>
            <p className="text-sm text-slate-500 mt-2">La cotización fue enviada a <strong>{to}</strong></p>
            <button onClick={handleClose} className="mt-6 px-6 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  )
}
