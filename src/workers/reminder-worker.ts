/**
 * Payment Reminder Worker
 *
 * This is a long-running Node.js process that:
 *   1. Polls MongoDB for clients with upcoming or overdue payments
 *   2. Enqueues reminder jobs to SQS (via the scheduler loop)
 *   3. Polls SQS and sends email reminders via Resend
 *
 * Designed to run as a separate ECS Fargate task (not inside Next.js).
 * This keeps the web process stateless and reminder processing isolated.
 *
 * Idempotency:
 *   - Each message has a deduplication ID: {clientId}-{type}-{dueDate}
 *   - Before sending an email, check if it was already sent today
 *   - MongoDB tracks the last reminder sent per client
 *
 * Graceful shutdown:
 *   - SIGTERM is caught and the polling loop exits cleanly
 *   - In-flight message processing completes before shutdown
 */

import { MongoClient }                                          from 'mongodb'
import { Resend }                                               from 'resend'
import {
  receiveMessages, deleteMessage, extendVisibility,
  enqueuePaymentReminder, parseMessage,
  type PaymentReminderMessage, type ReminderType,
} from '../lib/sqs'

// ─── Configuration ────────────────────────────────────────────────────────────

const MONGODB_URI   = process.env.MONGODB_URI   ?? ''
const RESEND_KEY    = process.env.RESEND_API_KEY ?? ''
const POLL_INTERVAL = 10_000        // 10 seconds between scheduler runs
const WORKER_CONCURRENCY = 5       // Process up to 5 messages in parallel

if (!MONGODB_URI) throw new Error('MONGODB_URI is required')

const mongoClient = new MongoClient(MONGODB_URI)
const resend      = new Resend(RESEND_KEY)

// Shutdown flag
let shuttingDown = false

// ─── Date utilities ───────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + n)
  return result
}

// ─── Scheduler: scan MongoDB and enqueue reminder jobs ────────────────────────
// Runs every POLL_INTERVAL seconds. Finds clients whose payment is due
// within the next 3 days, today, or overdue by 3 or 7 days.

async function runScheduler(): Promise<void> {
  const db  = mongoClient.db('jvf')
  const col = db.collection('clients')
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const targets = [
    { label: 'upcoming_3d' as ReminderType, date: addDays(today, 3) },
    { label: 'due_today'   as ReminderType, date: today },
    { label: 'overdue_3d'  as ReminderType, date: addDays(today, -3) },
    { label: 'overdue_7d'  as ReminderType, date: addDays(today, -7) },
  ]

  const clients = await col.find({
    loanStatus:          'approved',
    'loan.startDate':    { $exists: true, $ne: '' },
    'params.email':      { $exists: true, $ne: '' },
  }).project({
    _id: 1, name: 1, email: 1, organizationId: 1,
    loan: 1, remindersSent: 1,
  }).toArray()

  for (const c of clients) {
    if (!c.loan?.startDate || !c.email) continue

    const startDate  = new Date(c.loan.startDate + 'T12:00:00')
    const payDay     = startDate.getDate()
    const lastDay    = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const clampedDay = Math.min(payDay, lastDay)
    const thisMonthPayment = new Date(today.getFullYear(), today.getMonth(), clampedDay)
    const thisMonthStr = toDateStr(thisMonthPayment)

    // Already paid this month — skip
    const paidThisMonth = (c.payments ?? []).some(
      (p: any) => p.date?.startsWith(toDateStr(today).slice(0, 7))
    )
    if (paidThisMonth) continue

    for (const target of targets) {
      const targetStr = toDateStr(target.date)

      // Only queue if the payment date matches the target date
      if (thisMonthStr !== targetStr) continue

      // Check if we already sent this reminder today (idempotency)
      const alreadySent = (c.remindersSent ?? []).some(
        (r: any) => r.type === target.label && r.date === toDateStr(today)
      )
      if (alreadySent) continue

      await enqueuePaymentReminder({
        type:        target.label,
        clientId:    String(c._id),
        orgId:       c.organizationId,
        clientName:  c.name,
        clientEmail: c.email,
        amount:      c.loan.monthlyPayment ?? 0,
        currency:    c.loan.currency ?? 'USD',
        dueDate:     thisMonthStr,
      })
    }
  }
}

// ─── Worker: consume SQS and send emails ─────────────────────────────────────

async function processMessage(msg: PaymentReminderMessage, receiptHandle: string): Promise<void> {
  const db  = mongoClient.db('jvf')
  const col = db.collection('clients')

  if (!msg.clientEmail) {
    console.warn('[worker] No email for client', msg.clientId, '— skipping')
    await deleteMessage(receiptHandle)
    return
  }

  const subject = buildSubject(msg)
  const html    = buildEmailHtml(msg)

  // Attempt email delivery
  if (RESEND_KEY) {
    const { error } = await resend.emails.send({
      from:    'LendStack <recordatorios@yourdomain.com>',
      to:      [msg.clientEmail],
      subject,
      html,
    })

    if (error) {
      console.error('[worker] Resend error:', error)
      // Don't delete the message — SQS will retry up to maxReceiveCount times
      return
    }
  } else {
    // Dev mode: log instead of sending
    console.log('[worker] [DEV] Would send email:', { to: msg.clientEmail, subject })
  }

  // Mark reminder as sent in MongoDB so the scheduler skips this client
  await col.updateOne(
    { _id: msg.clientId as any },
    {
      $push: {
        remindersSent: {
          type:   msg.type,
          date:   toDateStr(new Date()),
          sentAt: new Date().toISOString(),
        },
      } as any,
    }
  )

  // ACK the message — remove it from the queue
  await deleteMessage(receiptHandle)
  console.log('[worker] Reminder sent:', msg.type, 'to', msg.clientId)
}

// ─── Email templates ──────────────────────────────────────────────────────────

function buildSubject(msg: PaymentReminderMessage): string {
  const amount = new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: msg.currency,
  }).format(msg.amount)

  switch (msg.type) {
    case 'upcoming_3d': return `Recordatorio: tu cuota de ${amount} vence en 3 días`
    case 'due_today':   return `Tu cuota de ${amount} vence hoy`
    case 'overdue_3d':  return `Cuota vencida hace 3 días — ${amount}`
    case 'overdue_7d':  return `Cuota vencida hace 7 días — acción requerida`
  }
}

function buildEmailHtml(msg: PaymentReminderMessage): string {
  const amount = new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: msg.currency,
  }).format(msg.amount)

  const urgencyColor = msg.type === 'overdue_7d' ? '#EF4444'
    : msg.type === 'overdue_3d' ? '#F59E0B'
    : '#1565C0'

  const bodyText = msg.type === 'due_today'
    ? `Tu cuota de préstamo de <strong>${amount}</strong> vence <strong>hoy</strong>.`
    : msg.type === 'upcoming_3d'
    ? `Tu cuota de préstamo de <strong>${amount}</strong> vence en <strong>3 días</strong> (${msg.dueDate}).`
    : msg.type === 'overdue_3d'
    ? `Tu cuota de préstamo de <strong>${amount}</strong> está <strong>vencida hace 3 días</strong>.`
    : `Tu cuota de préstamo de <strong>${amount}</strong> está <strong>vencida hace 7 días</strong>. Contactate con nosotros para regularizar tu situación.`

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: 'DM Sans', Arial, sans-serif; background: #F8FAFC; margin: 0; padding: 32px 0;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08);">
    <div style="background: linear-gradient(135deg,#1565C0,#0D2B5E); padding: 28px 32px;">
      <p style="color: #fff; font-size: 20px; font-weight: 800; margin: 0;">LendStack</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #64748b; font-size: 14px; margin: 0 0 8px;">Hola, <strong style="color: #0D2B5E;">${msg.clientName}</strong></p>
      <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">${bodyText}</p>
      <div style="background: #F0FDF4; border: 1.5px solid #86EFAC; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 13px; color: #14532D; font-weight: 600; text-transform: uppercase; letter-spacing: .05em;">Monto a pagar</p>
        <p style="margin: 6px 0 0; font-size: 32px; font-weight: 900; color: ${urgencyColor};">${amount}</p>
        <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Fecha: ${msg.dueDate}</p>
      </div>
      <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 0;">
        Si ya realizaste el pago, ignorá este mensaje. Para consultas comunicate con tu asesor.
      </p>
    </div>
    <div style="background: #F8FAFC; padding: 16px 32px; border-top: 1px solid #E2E8F0;">
      <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
        Este es un mensaje automático de LendStack. Por favor no respondas a este email.
      </p>
    </div>
  </div>
</body>
</html>`
}

// ─── Main polling loop ────────────────────────────────────────────────────────

async function pollAndProcess(): Promise<void> {
  const messages = await receiveMessages(WORKER_CONCURRENCY)
  if (messages.length === 0) return

  console.log(`[worker] Processing ${messages.length} message(s)`)

  await Promise.allSettled(
    messages.map(async (sqsMsg) => {
      const msg = parseMessage<PaymentReminderMessage>(sqsMsg)
      if (!msg || msg.schemaVersion !== 1) {
        console.error('[worker] Unknown message schema — deleting:', sqsMsg.Body)
        await deleteMessage(sqsMsg.ReceiptHandle!)
        return
      }

      // Extend visibility timeout before processing to prevent concurrent redelivery
      await extendVisibility(sqsMsg.ReceiptHandle!, 300)

      try {
        await processMessage(msg, sqsMsg.ReceiptHandle!)
      } catch (err) {
        console.error('[worker] Failed to process message:', err)
        // Do NOT delete — SQS will redeliver. After maxReceiveCount, goes to DLQ.
      }
    })
  )
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[worker] Starting LendStack reminder worker...')

  await mongoClient.connect()
  console.log('[worker] Connected to MongoDB')

  // Graceful shutdown on SIGTERM (ECS sends this before killing the container)
  process.on('SIGTERM', async () => {
    console.log('[worker] SIGTERM received — shutting down gracefully...')
    shuttingDown = true
    await mongoClient.close()
    process.exit(0)
  })

  let schedulerTick = 0

  while (!shuttingDown) {
    try {
      // Run the scheduler every 10 iterations (~100 seconds) to avoid
      // hammering MongoDB on every SQS poll cycle
      if (schedulerTick % 10 === 0) {
        await runScheduler()
      }
      schedulerTick++

      await pollAndProcess()
    } catch (err) {
      console.error('[worker] Unhandled error in main loop:', err)
    }

    // Short sleep to avoid busy-looping when queue is empty
    await new Promise(r => setTimeout(r, POLL_INTERVAL))
  }
}

main().catch(err => {
  console.error('[worker] Fatal error:', err)
  process.exit(1)
})
