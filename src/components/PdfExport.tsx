'use client'
import { LoanParams, LoanResult, RiskConfig, buildAmortization, formatCurrency, formatPercent } from '@/lib/loan'

interface Props {
  params: LoanParams
  result: LoanResult
  config: RiskConfig
}

export function downloadPdf({ params, result, config }: Props) {
  // Generate a complete HTML page and open for printing
  const fmt  = (v: number) => formatCurrency(v, params.currency)
  const rows  = buildAmortization(params)
  const today = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })
  const ref   = `JVF-${Date.now().toString().slice(-6)}`

  const tableRows = rows.map(r => `
    <tr>
      <td style="text-align:center;font-weight:700;color:#0D2B5E">${r.month}</td>
      <td>${fmt(r.openingBalance)}</td>
      <td style="font-weight:700;color:#0D2B5E">${fmt(r.payment)}</td>
      <td style="color:#1565C0">${fmt(r.principal)}</td>
      <td style="color:${config.colorAccent}">${fmt(r.interest)}</td>
      <td>${fmt(r.closingBalance)}</td>
      <td style="color:#64748b">${fmt(r.cumInterest)}</td>
      <td style="color:#64748b">${fmt(r.cumPrincipal)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>JVF Inversiones — ${ref}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;color:#374151;background:#fff;padding:32px;font-size:12px}
  .header{background:linear-gradient(135deg,#0D2B5E,#1565C0);color:#fff;border-radius:12px;padding:22px 28px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start}
  .brand{font-family:'DM Serif Display',serif;font-size:22px}
  .brand-sub{font-size:10px;opacity:.75;margin-top:3px;letter-spacing:.1em;text-transform:uppercase}
  .ref{text-align:right;font-size:11px;opacity:.8}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:20px}
  .box{background:#f8fafc;border-radius:8px;padding:12px;border:1px solid #e2e8f0}
  .box-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:4px}
  .box-val{font-family:'DM Serif Display',serif;font-size:18px;color:#0D2B5E}
  .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:8px;margin-top:20px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  thead tr{background:linear-gradient(135deg,#0D2B5E,#1565C0)}
  thead th{padding:8px 10px;color:#c5d5ea;font-weight:600;text-align:right}
  thead th:first-child{text-align:center}
  tbody tr:nth-child(even){background:#f8fafc}
  tbody td{padding:7px 10px;text-align:right;border-bottom:1px solid #e8eef7}
  .footer{margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;text-align:center}
  @media print{body{padding:16px}.header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<div class="header">
  <div><div class="brand">JVF Inversiones SRL</div><div class="brand-sub">Cotización de Préstamo — Tabla de Amortización</div></div>
  <div class="ref">📅 ${today}<br/>Ref: ${ref}</div>
</div>
<div class="grid">
  <div class="box"><div class="box-label">Monto del préstamo</div><div class="box-val">${fmt(params.amount)}</div></div>
  <div class="box"><div class="box-label">Plazo</div><div class="box-val">${params.termYears} años (${result.totalMonths} meses)</div></div>
  <div class="box" style="background:${config.colorBg}"><div class="box-label" style="color:${config.colorAccent}">Perfil de riesgo</div><div class="box-val" style="color:${config.colorText}">${config.emoji} ${config.label}</div></div>
  <div class="box" style="background:${config.colorBg}"><div class="box-label" style="color:${config.colorAccent}">${params.rateMode === 'monthly' ? 'Tasa mensual' : 'Tasa anual'}</div><div class="box-val" style="color:${config.colorText}">${params.rateMode === 'monthly' ? formatPercent(result.monthlyRate, 3) + ' / mes' : formatPercent(result.annualRate)}</div></div>
  <div class="box" style="background:#f0f4fa;border-color:#1565C044"><div class="box-label" style="color:#1565C0">Cuota mensual</div><div class="box-val" style="color:#0D2B5E">${fmt(result.monthlyPayment)}</div></div>
  <div class="box"><div class="box-label">Total a pagar</div><div class="box-val">${fmt(result.totalPayment)}</div></div>
  <div class="box"><div class="box-label">Total intereses</div><div class="box-val" style="color:${config.colorAccent}">${fmt(result.totalInterest)}</div></div>
  <div class="box"><div class="box-label">Costo financiamiento</div><div class="box-val">${formatPercent(result.interestRatio)}</div></div>
</div>
<div class="section-title">Tabla de amortización completa — ${result.totalMonths} cuotas</div>
<table>
<thead><tr>
  <th style="text-align:center">#</th><th>Saldo inicial</th><th>Cuota</th>
  <th>Capital</th><th>Interés</th><th>Saldo final</th><th>Int. acum.</th><th>Cap. acum.</th>
</tr></thead>
<tbody>${tableRows}</tbody>
</table>
<div class="footer">JVF Inversiones SRL · Los cálculos son referenciales y no constituyen asesoramiento financiero oficial. · ${today}</div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 600)
}

export default function PdfExportButton({ params, result, config }: Props) {
  return (
    <button
      onClick={() => downloadPdf({ params, result, config })}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
      style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}
    >
      📄 Exportar PDF
    </button>
  )
}
