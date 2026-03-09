import { NextRequest, NextResponse }      from 'next/server'
import { Resend }                         from 'resend'
import { getDb, isDbConfigured }          from '@/lib/mongodb'
import { upcomingPaymentHtml }            from '@/emails/upcoming-payment'
import { paymentDueHtml }                 from '@/emails/payment-due'
import { paymentOverdueHtml }             from '@/emails/payment-overdue'

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM ?? 'JVF Inversiones <onboarding@resend.dev>'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateDiffDays(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((da - db) / msPerDay)
}

function formatDateES(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function paymentDateThisMonth(startDate: Date, now: Date): Date {
  const payDay     = startDate.getDate()
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return new Date(now.getFullYear(), now.getMonth(), Math.min(payDay, lastOfMonth))
}

// ─── GET /api/cron/send-reminders ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth: Vercel passes Authorization: Bearer $CRON_SECRET automatically ──
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  const db         = await getDb()
  const clientsCol = db.collection('clients')
  const usersCol   = db.collection('users')

  const now      = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Fetch all approved clients with a loan start date
  const clients = await clientsCol.find({
    loanStatus:         'approved',
    'loan.startDate':   { $exists: true, $ne: '' },
  }).toArray()

  const results = {
    checked:  clients.length,
    sent:     0,
    skipped:  0,
    errors:   [] as string[],
  }

  // Cache master emails per org to avoid repeated DB lookups
  const masterEmailCache: Record<string, string | null> = {}

  for (const client of clients) {
    const startDate  = new Date(client.loan.startDate + 'T12:00:00')
    const payDate    = paymentDateThisMonth(startDate, now)
    const daysUntil  = dateDiffDays(payDate, now)   // positive = future, 0 = today, negative = past
    const payDateStr = formatDateES(payDate)

    const remindersSent: { type: string; month: string }[] = client.remindersSent ?? []
    const alreadySent = (type: string) =>
      remindersSent.some(r => r.type === type && r.month === monthStr)

    const markSent = (type: string) =>
      clientsCol.updateOne(
        { _id: client._id },
        { $push: { remindersSent: { type, month: monthStr, sentAt: new Date().toISOString() } as any } },
      )

    const sharedOpts = {
      clientName:     client.name   as string,
      currency:       client.loan?.currency as string,
      monthlyPayment: client.loan?.monthlyPayment as number,
      payDateStr,
    }

    // ── 3 days before due → borrower ──────────────────────────────────────
    if (daysUntil === 3 && client.email && !alreadySent('upcoming')) {
      try {
        await resend.emails.send({
          from:    FROM,
          to:      client.email as string,
          subject: 'Recordatorio: tu cuota vence en 3 días',
          html:    upcomingPaymentHtml({ ...sharedOpts, amount: client.loan?.amount }),
        })
        await markSent('upcoming')
        results.sent++
      } catch (e: any) {
        results.errors.push(`upcoming:${String(client._id)}: ${e.message}`)
      }
    }

    // ── Due today → borrower ───────────────────────────────────────────────
    if (daysUntil === 0 && client.email && !alreadySent('due')) {
      try {
        await resend.emails.send({
          from:    FROM,
          to:      client.email as string,
          subject: 'Tu cuota vence hoy — JVF Inversiones',
          html:    paymentDueHtml(sharedOpts),
        })
        await markSent('due')
        results.sent++
      } catch (e: any) {
        results.errors.push(`due:${String(client._id)}: ${e.message}`)
      }
    }

    // ── 1 day overdue → lender (master) ───────────────────────────────────
    if (daysUntil === -1 && !alreadySent('overdue')) {
      const hasPaidThisMonth = ((client.payments ?? []) as { date: string }[])
        .some(p => p.date?.startsWith(monthStr))

      if (hasPaidThisMonth) {
        results.skipped++
        continue
      }

      const orgId = client.organizationId as string
      if (!(orgId in masterEmailCache)) {
        const master = await usersCol.findOne({ organizationId: orgId, role: 'master' })
        masterEmailCache[orgId] = (master?.email as string | undefined) ?? null
      }

      const masterEmail = masterEmailCache[orgId]
      if (masterEmail) {
        try {
          await resend.emails.send({
            from:    FROM,
            to:      masterEmail,
            subject: `⚠️ Pago vencido sin registrar: ${client.name}`,
            html:    paymentOverdueHtml({
              clientName:     client.name     as string,
              clientEmail:    client.email    as string ?? '',
              clientPhone:    client.phone    as string ?? '',
              currency:       client.loan?.currency as string,
              monthlyPayment: client.loan?.monthlyPayment as number,
              payDateStr,
              branchName:     client.branchName as string ?? '',
            }),
          })
          await markSent('overdue')
          results.sent++
        } catch (e: any) {
          results.errors.push(`overdue:${String(client._id)}: ${e.message}`)
        }
      }
    }
  }

  return NextResponse.json({ ok: true, ...results })
}
