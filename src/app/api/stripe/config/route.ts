import { NextResponse } from 'next/server'
import { assertStripePublishableEnv, getStripePublishableKey } from '@/lib/stripe/config'

export async function GET() {
  try {
    assertStripePublishableEnv()
    return NextResponse.json({
      publishableKey: getStripePublishableKey(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Missing Stripe publishable key.' }, { status: 503 })
  }
}
