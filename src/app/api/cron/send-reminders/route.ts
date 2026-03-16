import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getDb, isDbConfigured } from '@/lib/mongodb'
import { upcomingPaymentHtml } from '@/emails/upcoming-payment'
import { paymentDueHtml } from '@/emails/payment-due'
import { paymentOverdueHtml } from '@/emails/payment-overdue'
import { BRAND } from '@/config/branding'
import { emitNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

function dateDiffDays(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((da - db) / msPerDay)
}

function formatDateES(date: Date): string {
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function paymentDateThisMonth(startDate: Date, now: Date): Date {
  const payDay = startDate.getDate()
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return new Date(now.getFullYear(), now.getMonth(), Math.min(payDay, lastOfMonth))
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const from = process.env.RESEND_FROM ?? BRAND.reminderFrom
  const db = await getDb()
  const clientsCol = db.collection('clients')
  const usersCol = db.collection('users')
  const orgsCol = db.collection('organizations')
  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const clients = await clientsCol.find({
    loanStatus: 'approved',
    'loan.startDate': { $exists: true, $ne: '' },
  }).toArray()

  const results = {
    checked: clients.length,
    sent: 0,
    skipped: 0,
    errors: [] as string[],
  }

  const masterEmailCache: Record<string, string | null> = {}

  for (const client of clients) {
    const startDate = new Date(client.loan.startDate + 'T12:00:00')
    const payDate = paymentDateThisMonth(startDate, now)
    const daysUntil = dateDiffDays(payDate, now)
    const payDateStr = formatDateES(payDate)
    const remindersSent: { type: string; month: string }[] = client.remindersSent ?? []
    const alreadySent = (type: string) => remindersSent.some((reminder) => reminder.type === type && reminder.month === monthStr)
    const markSent = (type: string) =>
      clientsCol.updateOne(
        { _id: client._id },
        { $push: { remindersSent: { type, month: monthStr, sentAt: new Date().toISOString() } as any } },
      )

    const sharedOpts = {
      clientName: client.name as string,
      currency: client.loan?.currency as string,
      monthlyPayment: client.loan?.monthlyPayment as number,
      payDateStr,
    }

    if (daysUntil === 3 && client.email && !alreadySent('upcoming')) {
      try {
        await resend.emails.send({
          from,
          to: client.email as string,
          subject: 'Recordatorio: tu cuota vence en 3 días',
          html: upcomingPaymentHtml({ ...sharedOpts, amount: client.loan?.amount }),
        })
        await markSent('upcoming')
        await emitNotification(db, {
          tenantId: String(client.organizationId),
          type: 'payment.due_soon',
          entityType: 'client',
          entityId: String(client._id),
          actionUrl: `/app/clientes?clientId=${String(client._id)}`,
          message: `${client.name} tiene una cuota próxima a vencer el ${payDateStr}.`,
          metadata: {
            clientId: String(client._id),
            clientName: client.name as string,
            dueDate: payDate.toISOString(),
            monthlyPayment: client.loan?.monthlyPayment ?? null,
            currency: client.loan?.currency ?? null,
          },
          dedupeKey: `payment.due_soon:${String(client._id)}:${monthStr}`,
        })
        results.sent++
      } catch (error: any) {
        results.errors.push(`upcoming:${String(client._id)}: ${error.message}`)
      }
    }

    if (daysUntil === 0 && client.email && !alreadySent('due')) {
      try {
        await resend.emails.send({
          from,
          to: client.email as string,
          subject: `Tu cuota vence hoy — ${BRAND.company}`,
          html: paymentDueHtml(sharedOpts),
        })
        await markSent('due')
        results.sent++
      } catch (error: any) {
        results.errors.push(`due:${String(client._id)}: ${error.message}`)
      }
    }

    if (daysUntil === -1 && !alreadySent('overdue')) {
      const hasPaidThisMonth = ((client.payments ?? []) as { date: string }[]).some((payment) => payment.date?.startsWith(monthStr))

      if (hasPaidThisMonth) {
        results.skipped++
        continue
      }

      const orgId = client.organizationId as string
      if (!(orgId in masterEmailCache)) {
        const organization = await orgsCol.findOne(
          { _id: orgId as any },
          { projection: { ownerEmail: 1, ownerUserId: 1 } },
        )
        const ownerEmail = (organization?.ownerEmail as string | undefined) ?? null
        if (ownerEmail) {
          masterEmailCache[orgId] = ownerEmail
        } else if (organization?.ownerUserId) {
          const owner = await usersCol.findOne({ _id: organization.ownerUserId as any }, { projection: { email: 1 } })
          masterEmailCache[orgId] = (owner?.email as string | undefined) ?? null
        } else {
          const master = await usersCol.findOne({ organizationId: orgId, role: 'master' }, { projection: { email: 1 } })
          masterEmailCache[orgId] = (master?.email as string | undefined) ?? null
        }
      }

      const masterEmail = masterEmailCache[orgId]
      if (masterEmail) {
        try {
          await resend.emails.send({
            from,
            to: masterEmail,
            subject: `Pago vencido sin registrar: ${client.name}`,
            html: paymentOverdueHtml({
              clientName: client.name as string,
              clientEmail: (client.email as string) ?? '',
              clientPhone: (client.phone as string) ?? '',
              currency: client.loan?.currency as string,
              monthlyPayment: client.loan?.monthlyPayment as number,
              payDateStr,
              branchName: (client.branchName as string) ?? '',
            }),
          })
          await markSent('overdue')
          await emitNotification(db, {
            tenantId: String(client.organizationId),
            type: 'payment.overdue',
            entityType: 'client',
            entityId: String(client._id),
            actionUrl: `/app/clientes?clientId=${String(client._id)}`,
            message: `${client.name} mantiene una cuota vencida sin registrar pago.`,
            metadata: {
              clientId: String(client._id),
              clientName: client.name as string,
              dueDate: payDate.toISOString(),
              monthlyPayment: client.loan?.monthlyPayment ?? null,
              currency: client.loan?.currency ?? null,
            },
            dedupeKey: `payment.overdue:${String(client._id)}:${monthStr}`,
          })
          results.sent++
        } catch (error: any) {
          results.errors.push(`overdue:${String(client._id)}: ${error.message}`)
        }
      }
    }
  }

  return NextResponse.json({ ok: true, ...results })
}
