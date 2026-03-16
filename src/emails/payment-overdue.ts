import { BRAND } from '@/config/branding'

export function paymentOverdueHtml(opts: {
  clientName: string
  clientEmail: string
  clientPhone: string
  currency: string
  monthlyPayment: number
  payDateStr: string
  branchName: string
}) {
  const { clientName, clientEmail, clientPhone, currency, monthlyPayment, payDateStr, branchName } = opts
  const fmtAmount = (n: number) =>
    `${currency} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr>
          <td style="background:linear-gradient(135deg,#7F1D1D 0%,#DC2626 100%);padding:28px 32px;text-align:center">
            <p style="margin:0;color:#fecaca;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${BRAND.company} — Alerta interna</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800">Pago vencido sin registrar</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6">
              El siguiente cliente no registró el pago de su cuota que venció <strong>ayer (${payDateStr})</strong>:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #FECDD3;border-radius:12px;overflow:hidden">
              <tr>
                <td style="background:#FFF1F2;padding:16px 20px;border-bottom:1px solid #FECDD3">
                  <p style="margin:0;color:#881337;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Datos del cliente</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:4px 0;color:#6B7280;font-size:13px;width:120px">Nombre</td>
                      <td style="padding:4px 0;color:#0D2B5E;font-size:13px;font-weight:700">${clientName}</td>
                    </tr>
                    ${clientEmail ? `<tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Email</td><td style="padding:4px 0;color:#0D2B5E;font-size:13px">${clientEmail}</td></tr>` : ''}
                    ${clientPhone ? `<tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Teléfono</td><td style="padding:4px 0;color:#0D2B5E;font-size:13px">${clientPhone}</td></tr>` : ''}
                    ${branchName ? `<tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Sucursal</td><td style="padding:4px 0;color:#0D2B5E;font-size:13px">${branchName}</td></tr>` : ''}
                    <tr>
                      <td style="padding:4px 0;color:#6B7280;font-size:13px">Cuota</td>
                      <td style="padding:4px 0;color:#DC2626;font-size:16px;font-weight:900">${fmtAmount(monthlyPayment)}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;color:#6B7280;font-size:13px">Venció el</td>
                      <td style="padding:4px 0;color:#DC2626;font-size:13px;font-weight:700">${payDateStr}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6">
              Recomendamos contactar al cliente para coordinar el pago o tomar las acciones correspondientes según la política interna.
            </p>
            <p style="margin:0;color:#374151;font-size:14px">— <strong>${BRAND.company} · Sistema automático</strong></p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center">
            <p style="margin:0;color:#94a3b8;font-size:11px">Alerta generada automáticamente por ${BRAND.company}. No respondas este correo.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
