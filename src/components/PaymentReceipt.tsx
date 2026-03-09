'use client'
import { useState } from 'react'
import { formatCurrency } from '@/lib/loan'
import type { Currency }  from '@/lib/loan'

// ─── Data shape ───────────────────────────────────────────────────────────────

export interface ReceiptData {
  clientName:     string
  clientIdType:   string
  clientId:       string
  clientEmail:    string
  paymentId:      string
  date:           string        // YYYY-MM-DD
  amount:         number
  cuotaNumber?:   number
  notes?:         string
  currency:       string
  loanAmount:     number
  monthlyPayment: number
  totalMonths:    number
  profile:        string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(s: string | undefined | null): string {
  return (s ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
      .toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}

// ─── Print-to-PDF via new window (used on direct user clicks only) ────────────
// NOTE: Only call this from a direct onClick handler, never from async code,
// or browsers will block the popup.

export function printPaymentReceipt(data: ReceiptData, recNum?: string) {
  const fmt    = (v: number) => formatCurrency(v, data.currency as Currency)
  const today  = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
  const ref    = recNum ?? `REC-${Date.now().toString().slice(-8)}`

  const idBlock = data.clientId ? `
    <div class="field">
      <div class="field-label">${escHtml(data.clientIdType) || 'Documento'}</div>
      <div class="field-value">${escHtml(data.clientId)}</div>
    </div>` : ''

  const emailBlock = data.clientEmail ? `
    <div class="field">
      <div class="field-label">Correo electrónico</div>
      <div class="field-value">${escHtml(data.clientEmail)}</div>
    </div>` : ''

  const amountSub = data.cuotaNumber
    ? `Cuota N.º&nbsp;${data.cuotaNumber}${data.notes ? ` &middot; ${escHtml(data.notes)}` : ''}`
    : data.notes ? escHtml(data.notes) : 'Pago registrado'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Recibo de Pago — ${ref}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;600;700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;color:#374151;background:#f1f5f9;padding:32px;font-size:12px;display:flex;justify-content:center;min-height:100vh}
  .page{background:#fff;border-radius:16px;max-width:620px;width:100%;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.14)}
  .header{background:linear-gradient(135deg,#0D2B5E,#1565C0);color:#fff;padding:24px 28px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  .brand{font-family:'DM Serif Display',serif;font-size:24px;letter-spacing:-.02em}
  .brand-sub{font-size:9px;opacity:.65;margin-top:3px;letter-spacing:.14em;text-transform:uppercase}
  .doc-type{text-align:right;flex-shrink:0}
  .doc-type-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;opacity:.7}
  .doc-type-num{font-family:'DM Serif Display',serif;font-size:18px;margin-top:4px}
  .accent-bar{height:4px;background:linear-gradient(90deg,#1565C0,#42a5f5,#90caf9)}
  .body{padding:24px 28px}
  .meta-row{display:flex;margin-bottom:18px}
  .meta-item{flex:1;padding:10px 14px;background:#f8fafc;border:1px solid #e8eef7}
  .meta-item:first-child{border-radius:10px 0 0 10px}
  .meta-item:last-child{border-radius:0 10px 10px 0}
  .meta-item+.meta-item{border-left:none}
  .meta-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:3px}
  .meta-value{font-size:12px;font-weight:700;color:#1e293b}
  .section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#94a3b8;margin:16px 0 10px}
  .client-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px}
  .field{background:#f8fafc;border-radius:8px;padding:10px 13px;border:1px solid #e8eef7}
  .field.span2{grid-column:1/-1}
  .field-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:3px}
  .field-value{font-size:13px;font-weight:700;color:#1e293b}
  .amount-box{background:linear-gradient(135deg,#EEF4FF,#DCE8FF);border:2px solid #1565C030;border-radius:14px;padding:22px 24px;text-align:center;margin:20px 0}
  .amount-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.16em;color:#1565C0;margin-bottom:10px}
  .amount-value{font-family:'DM Serif Display',serif;font-size:42px;color:#0D2B5E;line-height:1}
  .amount-sub{font-size:12px;color:#64748b;margin-top:8px;font-weight:600}
  .loan-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px}
  .loan-box{background:#f8fafc;border-radius:8px;padding:10px 8px;border:1px solid #e8eef7;text-align:center}
  .loan-label{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:4px}
  .loan-val{font-size:11px;font-weight:800;color:#0D2B5E;line-height:1.2}
  .sigs{display:flex;gap:32px;margin-top:28px;margin-bottom:4px;padding-top:8px}
  .sig{flex:1;text-align:center}
  .sig-space{height:40px}
  .sig-line{height:1px;background:#cbd5e1}
  .sig-label{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-top:7px}
  .footer{background:#f1f5f9;padding:14px 28px;display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:24px;border-top:1px solid #e2e8f0}
  .footer-text{font-size:9px;color:#94a3b8;line-height:1.6}
  .valid-badge{font-size:9px;font-weight:700;text-transform:uppercase;color:#15803d;background:#f0fdf4;border:1px solid #86efac;border-radius:9999px;padding:4px 12px;white-space:nowrap;flex-shrink:0}
  @media print{
    body{background:#fff;padding:0}
    .page{border-radius:0;box-shadow:none;max-width:100%}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand">LendStack</div>
      <div class="brand-sub">JVF Inversiones SRL</div>
    </div>
    <div class="doc-type">
      <div class="doc-type-label">Documento</div>
      <div class="doc-type-num">RECIBO&nbsp;DE&nbsp;PAGO</div>
    </div>
  </div>
  <div class="accent-bar"></div>
  <div class="body">
    <div class="meta-row">
      <div class="meta-item">
        <div class="meta-label">N.º de recibo</div>
        <div class="meta-value" style="color:#0D2B5E;font-size:14px">${ref}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Fecha de pago</div>
        <div class="meta-value">${fmtDate(data.date)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Fecha de emisión</div>
        <div class="meta-value">${today}</div>
      </div>
    </div>
    <div class="section-title">Datos del cliente</div>
    <div class="client-grid">
      <div class="field span2">
        <div class="field-label">Nombre completo</div>
        <div class="field-value" style="font-size:15px">${escHtml(data.clientName)}</div>
      </div>
      ${idBlock}${emailBlock}
    </div>
    <div class="amount-box">
      <div class="amount-label">💵 Monto recibido</div>
      <div class="amount-value">${fmt(data.amount)}</div>
      <div class="amount-sub">${amountSub}</div>
    </div>
    <div class="section-title">Referencia del préstamo</div>
    <div class="loan-grid">
      <div class="loan-box"><div class="loan-label">Monto del préstamo</div><div class="loan-val">${fmt(data.loanAmount)}</div></div>
      <div class="loan-box"><div class="loan-label">Cuota mensual</div><div class="loan-val">${fmt(data.monthlyPayment)}</div></div>
      <div class="loan-box"><div class="loan-label">Plazo total</div><div class="loan-val">${data.totalMonths}&nbsp;meses</div></div>
      <div class="loan-box"><div class="loan-label">Moneda</div><div class="loan-val">${escHtml(data.currency)}</div></div>
    </div>
    <div class="sigs">
      <div class="sig"><div class="sig-space"></div><div class="sig-line"></div><div class="sig-label">Firma del cliente</div></div>
      <div class="sig"><div class="sig-space"></div><div class="sig-line"></div><div class="sig-label">Firma del agente</div></div>
    </div>
  </div>
  <div class="footer">
    <div class="footer-text">JVF Inversiones SRL · Comprobante de pago oficial<br/>Emitido el ${today} · Ref: ${ref}</div>
    <div class="valid-badge">✓ Válido</div>
  </div>
</div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 600)
}

// ─── Inline Receipt Modal ─────────────────────────────────────────────────────
// Renders the receipt inside the page — avoids popup blockers entirely.
// The "Imprimir" button is a direct user click → safe to call window.open then.

export function PaymentReceiptModal({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const fmt = (v: number) => formatCurrency(v, data.currency as Currency)
  // Generate receipt number once on mount so it stays stable across re-renders
  const [recNum] = useState(() => `REC-${Date.now().toString().slice(-8)}`)
  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto"
      style={{ background: 'rgba(7,26,62,.88)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>

      <div
        className="relative w-full sm:max-w-lg sm:my-4"
        onClick={e => e.stopPropagation()}>

        {/* ── Receipt card ── */}
        <div className="bg-white sm:rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 8px 40px rgba(0,0,0,.25)' }}>

          {/* Header */}
          <div className="px-6 py-5 flex justify-between items-start gap-3"
            style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
            <div>
              <p className="text-xl font-black text-white" style={{ fontFamily: 'DM Serif Display, serif' }}>LendStack</p>
              <p className="text-[9px] text-blue-200 mt-0.5 tracking-[.14em] uppercase">JVF Inversiones SRL</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[9px] text-blue-300 uppercase tracking-[.15em]">Documento</p>
              <p className="text-sm font-black text-white mt-1 tracking-wide">RECIBO DE PAGO</p>
            </div>
          </div>
          <div className="h-1" style={{ background: 'linear-gradient(90deg,#1565C0,#42a5f5,#90caf9)' }} />

          {/* Body */}
          <div className="px-5 pt-4 pb-5 space-y-4">

            {/* Meta strip */}
            <div className="flex rounded-xl overflow-hidden border border-slate-100">
              {[
                { label: 'N.º de recibo', value: recNum, accent: true },
                { label: 'Fecha de pago',  value: fmtDate(data.date) },
                { label: 'Emitido',        value: today },
              ].map((m, i) => (
                <div key={i} className="flex-1 px-3 py-2 bg-slate-50"
                  style={{ borderLeft: i > 0 ? '1px solid #e8eef7' : undefined }}>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{m.label}</p>
                  <p className="text-[11px] font-bold leading-tight"
                    style={{ color: m.accent ? '#0D2B5E' : '#374151' }}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Client */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">Datos del cliente</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Nombre completo</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: '#1e293b' }}>{data.clientName}</p>
                </div>
                {data.clientId && (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{data.clientIdType || 'Documento'}</p>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: '#1e293b' }}>{data.clientId}</p>
                  </div>
                )}
                {data.clientEmail && (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Correo electrónico</p>
                    <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: '#1e293b' }}>{data.clientEmail}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Amount */}
            <div className="rounded-xl py-5 px-5 text-center"
              style={{ background: 'linear-gradient(135deg,#EEF4FF,#DCE8FF)', border: '2px solid rgba(21,101,192,.15)' }}>
              <p className="text-[9px] font-bold uppercase tracking-[.16em] mb-2" style={{ color: '#1565C0' }}>
                💵 Monto recibido
              </p>
              <p className="text-4xl font-black leading-none" style={{ fontFamily: 'DM Serif Display, serif', color: '#0D2B5E' }}>
                {fmt(data.amount)}
              </p>
              <p className="text-xs font-semibold mt-2" style={{ color: '#64748b' }}>
                {data.cuotaNumber ? `Cuota N.º ${data.cuotaNumber}` : 'Pago registrado'}
                {data.notes ? ` · ${data.notes}` : ''}
              </p>
            </div>

            {/* Loan reference */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">Referencia del préstamo</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Monto',       value: fmt(data.loanAmount) },
                  { label: 'Cuota/mes',   value: fmt(data.monthlyPayment) },
                  { label: 'Plazo',       value: `${data.totalMonths} meses` },
                  { label: 'Moneda',      value: data.currency },
                ].map(b => (
                  <div key={b.label} className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-2.5 text-center">
                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400 leading-tight mb-1">{b.label}</p>
                    <p className="text-[11px] font-black" style={{ color: '#0D2B5E' }}>{b.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Signatures */}
            <div className="flex gap-8 pt-2">
              {['Firma del cliente', 'Firma del agente'].map(l => (
                <div key={l} className="flex-1 text-center">
                  <div className="h-8" />
                  <div className="h-px bg-slate-300" />
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-1.5">{l}</p>
                </div>
              ))}
            </div>

          </div>

          {/* Footer */}
          <div className="px-5 py-3 flex items-center justify-between gap-3 bg-slate-50 border-t border-slate-100">
            <p className="text-[8px] text-slate-400 leading-relaxed">
              JVF Inversiones SRL · Comprobante de pago oficial<br/>
              Emitido el {today} · Ref: {recNum}
            </p>
            <span className="text-[8px] font-bold uppercase tracking-wide flex-shrink-0 px-3 py-1 rounded-full"
              style={{ color: '#15803d', background: '#f0fdf4', border: '1px solid #86efac' }}>
              ✓ Válido
            </span>
          </div>
        </div>

        {/* ── Action buttons (below the card, over the dark backdrop) ── */}
        <div className="flex gap-3 p-4 sm:p-0 sm:mt-4">
          <button
            onClick={() => printPaymentReceipt(data, recNum)}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
            🖨️ Imprimir / Guardar PDF
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl text-sm font-bold transition-colors flex-shrink-0"
            style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: '2px solid rgba(255,255,255,.25)' }}>
            ✕ Cerrar
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── Re-print button (used in payment list rows — direct user click) ───────────

export default function PrintReceiptButton({ data }: { data: ReceiptData }) {
  return (
    <button
      onClick={() => printPaymentReceipt(data)}
      className="text-xs font-semibold rounded-lg px-2 py-1 transition-colors text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex-shrink-0"
      title="Imprimir recibo de pago">
      🧾
    </button>
  )
}
