import { NextRequest, NextResponse } from 'next/server'
import { handleStripeWebhook, getStripeClient, isStripeConfigured } from '@/lib/stripeBilling'
import { isDbConfigured } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!isStripeConfigured() || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe no está configurado.' }, { status: 503 })
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
  }

  try {
    const stripe = getStripeClient()
    const body = await req.text()
    const signature = req.headers.get('stripe-signature') ?? ''

    let event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (error: any) {
      console.error('[stripe webhook] signature verification failed:', error.message)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const result = await handleStripeWebhook(event as any)
    return NextResponse.json({ received: true, duplicate: !!result.duplicate })
  } catch (error: any) {
    console.error('[stripe webhook]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
