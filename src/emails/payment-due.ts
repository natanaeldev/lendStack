import { BRAND } from '@/config/branding'

export function paymentDueHtml(opts: {
  clientName: string
  currency: string
  monthlyPayment: number
  payDateStr: string
}) {
  const { clientName, currency, monthlyPayment, payDateStr } = opts
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
          <td style="background:linear-gradient(135deg,#14532D 0%,#16A34A 100%);padding:28px 32px;text-align:center">
            <p style="margin:0;color:#bbf7d0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${BRAND.company}</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800">Tu cuota vence hoy</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 16px;color:#374151;font-size:15px">Hola <strong>${clientName}</strong>,</p>
            <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6">
              Tu cuota del préstamo vence <strong>hoy, ${payDateStr}</strong>. Te pedimos que realices el pago a la brevedad posible.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:12px;padding:20px;text-align:center">
                  <p style="margin:0 0 4px;color:#14532D;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Monto a pagar hoy</p>
                  <p style="margin:0;color:#14532D;font-size:32px;font-weight:900">${fmtAmount(monthlyPayment)}</p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;color:#6B7280;font-size:13px;line-height:1.6">
              Si ya realizaste el pago, por favor ignorá este mensaje. En caso de algún inconveniente, comunicate con nosotros.
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
