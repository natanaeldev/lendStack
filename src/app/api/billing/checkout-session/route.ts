import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient, isStripeConfigured } from '@/lib/stripeBilling'

export async function GET(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe no está configurado.' }, { status: 503 })
  }

  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id es obligatorio.' }, { status: 400 })
  }

  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    return NextResponse.json({
      id: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      customerId: session.customer ? String(session.customer) : null,
      subscriptionId: session.subscription
        ? typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id
        : null,
      metadata: session.metadata ?? {},
    })
  } catch (error: any) {
    console.error('[GET /api/billing/checkout-session]', error)
    return NextResponse.json({ error: 'No se pudo consultar la sesión de checkout.' }, { status: 500 })
  }
}
