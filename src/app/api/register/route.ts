import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBillingPlanByCheckoutKey } from '@/lib/billingPlans'
import { createOrganizationCheckoutSession, isStripeConfigured } from '@/lib/stripeBilling'
import { getDb, getMongoClient, isDbConfigured } from '@/lib/mongodb'
import { runSelfServiceOnboarding } from '@/lib/selfServiceOnboarding'
import { handleRegisterOnboarding } from '@/lib/organizationApi'

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const session = await getServerSession(authOptions)

    const client = await getMongoClient()
    const db = await getDb()
    const result = await handleRegisterOnboarding(
      body,
      {
        getBillingPlanByCheckoutKey,
        isStripeConfigured,
        runSelfServiceOnboarding: (input) => runSelfServiceOnboarding(client, db, input as any),
        createOrganizationCheckoutSession,
      },
      session?.user
        ? {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
          }
        : null,
    )

    if (result.status === 400 && result.body.errorCode === 'use_organization_creation_endpoint' && session?.user?.id) {
      console.warn('[POST /api/register] onboarding conflict', {
        userId: session.user.id,
        email: session.user.email,
        errorCode: result.body.errorCode,
        message: result.body.error,
      })
    }
    if (result.status === 409) {
      console.warn('[POST /api/register] duplicate key conflict', {
        errorCode: result.body.errorCode,
        message: result.body.error,
      })
    }
    return NextResponse.json(result.body, { status: result.status })
  } catch (error: any) {
    console.error('[POST /api/register]', error)
    return NextResponse.json({ error: 'No se pudo completar el onboarding.' }, { status: 500 })
  }
}
