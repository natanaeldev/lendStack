'use client'
import { useState } from 'react'
import { LoanParams, LoanResult, RiskConfig, RISK_PROFILES, formatCurrency, formatPercent, Currency, RateMode } from '@/lib/loan'

interface Props {
  isOpen:    boolean
  onClose:   () => void
  params:    LoanParams
  result:    LoanResult
  config:    RiskConfig
  defaultTo?: string
}

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function EmailModal({ isOpen, onClose, params, result, config, defaultTo = '' }: Props) {
  const [to,      setTo]      = useState(defaultTo)
  const [message, setMessage] = useState('')
  const [status,  setStatus]  = useState<Status>('idle')

  if (!isOpen) return null

  const fmt = (v: number) => formatCurrency(v, params.currency)

  const handleSend = async () => {
    if (!to || !to.includes('@')) return
    setStatus('sending')
    // In production this would POST to /api/send-email (Resend / SendGrid)
    // Here we simulate the delay
    await new Promise(r => setTimeout(r, 1800))
    setStatus('sent')
  }

  const handleClose = () => {
    setTo(defaultTo); setMessage(''); setStatus('idle'); onClose()
  }

  const rows = [
    ['Monto',         fmt(params.amount)],
    ['Plazo',         `${params.termYears} años (${result.totalMonths} meses)`],
    ['Perfil',        `${config.emoji} ${config.label}`],
    [params.rateMode === 'monthly' ? 'Tasa mensual' : 'Tasa anual',
      params.rateMode === 'monthly'
        ? formatPercent(result.monthlyRate, 3) + ' / mes'
        : formatPercent(result.annualRate)],
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

            <div className="flex gap-3 justify-end">
              <button onClick={handleClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={handleSend} disabled={status === 'sending' || !to.includes('@')}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                style={{ background: '#2e7d32' }}>
                {status === 'sending' ? '⏳ Enviando...' : '📨 Enviar'}
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
