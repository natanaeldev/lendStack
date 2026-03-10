import { NextRequest, NextResponse } from 'next/server'
import { getDb, isDbConfigured }    from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

// ─── POST /api/webhooks/stripe ─────────────────────────────────────────────────
// Handles Stripe events: subscription created/updated/deleted.
// Requires env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
export async function POST(req: NextRequest) {
  const stripeSecretKey  = process.env.STRIPE_SECRET_KEY
  const webhookSecret    = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-02-24.acacia' as any })

    const body      = await req.text()
    const signature = req.headers.get('stripe-signature') ?? ''

    let event: import('stripe').Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('[stripe webhook] signature verification failed:', err.message)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const db      = await getDb()
    const orgsCol = db.collection('organizations')
    const now     = new Date().toISOString()

    // ── checkout.session.completed → upgrade org to pro ───────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as import('stripe').Stripe.Checkout.Session
      const orgId   = session.metadata?.orgId

      if (orgId && session.customer && session.subscription) {
        await orgsCol.updateOne(
          { _id: orgId as any },
          {
            $set: {
              plan:                   'pro',
              stripeCustomerId:       String(session.customer),
              stripeSubscriptionId:   String(session.subscription),
              updatedAt:              now,
            },
          }
        )
        console.log(`[stripe webhook] org ${orgId} upgraded to pro`)
      }
    }

    // ── customer.subscription.updated → sync plan ─────────────────────────────
    if (event.type === 'customer.subscription.updated') {
      const sub    = event.data.object as import('stripe').Stripe.Subscription
      const status = sub.status  // 'active' | 'past_due' | 'canceled' | ...

      const org = await orgsCol.findOne({ stripeSubscriptionId: sub.id })
      if (org) {
        const newPlan = status === 'active' ? 'pro' : 'starter'
        await orgsCol.updateOne(
          { _id: org._id },
          { $set: { plan: newPlan, updatedAt: now } }
        )
        console.log(`[stripe webhook] org ${org._id} plan set to ${newPlan} (sub status: ${status})`)
      }
    }

    // ── customer.subscription.deleted → downgrade to starter ─────────────────
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as import('stripe').Stripe.Subscription
      const org = await orgsCol.findOne({ stripeSubscriptionId: sub.id })

      if (org) {
        await orgsCol.updateOne(
          { _id: org._id },
          {
            $set: {
              plan:                   'starter',
              stripeSubscriptionId:   null,
              updatedAt:              now,
            },
          }
        )
        console.log(`[stripe webhook] org ${org._id} downgraded to starter`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('[stripe webhook]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
