/**
 * SQS client — async job queue for payment reminders and background work.
 *
 * Design:
 *   - The web app (Next.js) is a PRODUCER: it sends reminder jobs to the queue.
 *   - The worker process is the CONSUMER: it polls and processes jobs.
 *   - Jobs are idempotent: processing the same message twice has no effect
 *     because the worker checks if the reminder was already sent.
 *   - Message body is JSON. Always include a schema version field so the worker
 *     can handle multiple message formats as the schema evolves.
 */

import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
  type Message,
} from '@aws-sdk/client-sqs'

const sqs = new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

const QUEUE_URL = process.env.AWS_SQS_REMINDERS_URL

// ─── Message schemas ──────────────────────────────────────────────────────────

export type ReminderType = 'due_today' | 'overdue_3d' | 'overdue_7d' | 'upcoming_3d'

export interface PaymentReminderMessage {
  schemaVersion: 1
  type:          ReminderType
  clientId:      string
  orgId:         string
  clientName:    string
  clientEmail:   string
  amount:        number
  currency:      string
  dueDate:       string  // YYYY-MM-DD
  sentAt?:       string  // Set by worker after sending — idempotency check
}

// ─── Producer: send a reminder job ───────────────────────────────────────────

export async function enqueuePaymentReminder(
  msg: Omit<PaymentReminderMessage, 'schemaVersion'>
): Promise<void> {
  if (!QUEUE_URL) {
    // In local dev without SQS, log and skip
    console.log('[SQS] Queue not configured — skipping reminder:', msg)
    return
  }

  const body: PaymentReminderMessage = { schemaVersion: 1, ...msg }

  await sqs.send(new SendMessageCommand({
    QueueUrl:               QUEUE_URL,
    MessageBody:            JSON.stringify(body),
    // Deduplication: same client + type in same day = same dedup ID.
    // Prevents double-sending if the web app sends the job twice.
    MessageDeduplicationId: `${msg.clientId}-${msg.type}-${msg.dueDate}`,
    // Message group is not used for standard queues (only FIFO).
    // Delay delivery by 0 seconds (process immediately).
    DelaySeconds: 0,
  }))
}

// ─── Consumer: receive messages (used by the worker) ─────────────────────────

export async function receiveMessages(maxMessages = 10): Promise<Message[]> {
  if (!QUEUE_URL) return []

  const result = await sqs.send(new ReceiveMessageCommand({
    QueueUrl:            QUEUE_URL,
    MaxNumberOfMessages: maxMessages,
    WaitTimeSeconds:     20,      // Long polling: wait up to 20s for messages
    VisibilityTimeout:   300,     // Lock message for 5 min while processing
    AttributeNames:      ['ApproximateReceiveCount'],
    MessageAttributeNames: ['All'],
  }))

  return result.Messages ?? []
}

export async function deleteMessage(receiptHandle: string): Promise<void> {
  if (!QUEUE_URL) return
  await sqs.send(new DeleteMessageCommand({ QueueUrl: QUEUE_URL, ReceiptHandle: receiptHandle }))
}

/** Extend visibility if processing takes longer than expected */
export async function extendVisibility(
  receiptHandle: string,
  extraSeconds: number
): Promise<void> {
  if (!QUEUE_URL) return
  await sqs.send(new ChangeMessageVisibilityCommand({
    QueueUrl:          QUEUE_URL,
    ReceiptHandle:     receiptHandle,
    VisibilityTimeout: extraSeconds,
  }))
}

export function parseMessage<T = PaymentReminderMessage>(msg: Message): T | null {
  try {
    return JSON.parse(msg.Body ?? '') as T
  } catch {
    console.error('[SQS] Failed to parse message body:', msg.Body)
    return null
  }
}

export const isSqsConfigured = () => !!process.env.AWS_SQS_REMINDERS_URL
