import { BRAND } from '@/config/branding'

export function upcomingPaymentHtml(opts: {
  clientName: string
  amount: number
  currency: string
  payDateStr: string
  monthlyPayment: number
}) {
  const { clientName, currency, payDateStr, monthlyPayment } = opts
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
          <td style="background:linear-gradient(135deg,#071a3e 0%,#0D2B5E 55%,#1565C0 100%);padding:28px 32px;text-align:center">
            <p style="margin:0;color:#90cdf4;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${BRAND.company}</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800">Recordatorio de pago</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 16px;color:#374151;font-size:15px">Hola <strong>${clientName}</strong>,</p>
            <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6">
              Te recordamos que tu próxima cuota vence en <strong>3 días</strong>, el <strong>${payDateStr}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td style="background:#EEF4FF;border:1px solid #BFDBFE;border-radius:12px;padding:20px;text-align:center">
                  <p style="margin:0 0 4px;color:#1E40AF;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Monto a pagar</p>
                  <p style="margin:0;color:#0D2B5E;font-size:32px;font-weight:900">${fmtAmount(monthlyPayment)}</p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;color:#6B7280;font-size:13px;line-height:1.6">
              Por favor asegurate de tener los fondos disponibles antes de la fecha de vencimiento para evitar cargos por mora.
            </p>
            <p style="margin:0;color:#374151;font-size:14px">Saludos,<br><strong>Equipo ${BRAND.company}</strong></p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center">
            <p style="margin:0;color:#94a3b8;font-size:11px">Este es un mensaje automático. Por favor no respondas este correo.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
