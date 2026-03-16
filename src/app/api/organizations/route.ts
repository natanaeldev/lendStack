import { NextRequest, NextResponse } from 'next/server'
import { getBillingPlanByCheckoutKey } from '@/lib/billingPlans'
import { getMongoClient, getDb, isDbConfigured } from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { createOrganizationCheckoutSession, isStripeConfigured } from '@/lib/stripeBilling'
import { runSelfServiceOnboarding } from '@/lib/selfServiceOnboarding'
import { handleAuthenticatedOrganizationCreation } from '@/lib/organizationApi'

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const client = await getMongoClient()
    const db = await getDb()

    const result = await handleAuthenticatedOrganizationCreation(
      body,
      {
        getBillingPlanByCheckoutKey,
        isStripeConfigured,
        runSelfServiceOnboarding: (input) => runSelfServiceOnboarding(client, db, input as any),
        createOrganizationCheckoutSession,
      },
      {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
    )

    if (result.status === 409) {
      console.warn('[POST /api/organizations] conflict', {
        userId: session.user.id,
        email: session.user.email,
        errorCode: result.body.errorCode,
        message: result.body.error,
      })
    }

    return NextResponse.json(result.body, { status: result.status })
  } catch (error: any) {
    console.error('[POST /api/organizations]', error)
    return NextResponse.json({ error: 'No se pudo crear la organizacion.' }, { status: 500 })
  }
}
