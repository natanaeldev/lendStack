import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBillingPlanByCheckoutKey, type BillingPlanInterval, type BillingProductKey } from '@/lib/billingPlans'
import { createOrganizationCheckoutSession, isStripeConfigured } from '@/lib/stripeBilling'
import { getDb, getMongoClient, isDbConfigured } from '@/lib/mongodb'
import { runSelfServiceOnboarding } from '@/lib/selfServiceOnboarding'
import { handleRegisterOnboarding } from '@/lib/organizationApi'

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: 'Base de datos no configurada.' },
      { status: 503 },
    )
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
        runSelfServiceOnboarding: (input) => runSelfServiceOnboarding(client, db, input),
        createOrganizationCheckoutSession,
        findPendingCheckoutRecovery: async (email: string) => {
          const normalizedEmail = String(email).trim().toLowerCase()
          if (!normalizedEmail) return null

          const pendingOrg = await db.collection('organizations').findOne(
            {
              ownerEmail: normalizedEmail,
              billingStatus: 'pending_checkout',
            },
            {
              sort: { updatedAt: -1 },
              projection: {
                _id: 1,
                ownerUserId: 1,
                billingPlan: 1,
                billingInterval: 1,
              },
            },
          )

          if (!pendingOrg?._id) return null

          const ownerUserId = pendingOrg.ownerUserId
            ? String(pendingOrg.ownerUserId)
            : null
          const ownerUser =
            ownerUserId
              ? await db.collection('users').findOne(
                  { _id: pendingOrg.ownerUserId as any },
                  { projection: { _id: 1 } },
                )
              : await db.collection('users').findOne(
                  { email: normalizedEmail },
                  { projection: { _id: 1 } },
                )

          if (!ownerUser?._id) return null

          return {
            organizationId: String(pendingOrg._id),
            userId: String(ownerUser._id),
            planKey: (pendingOrg.billingPlan ?? 'pro') as BillingProductKey,
            interval: (pendingOrg.billingInterval ?? 'month') as BillingPlanInterval,
          }
        },
      },
      session?.user
        ? {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            organizationId: session.user.organizationId,
          }
        : null,
    )

    if (result.status >= 400) {
      console.warn('[POST /api/register] error', {
        sessionUserId: session?.user?.id ?? null,
        errorCode: result.body.errorCode,
        message: result.body.error,
      })
    }

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('[POST /api/register]', error)
    return NextResponse.json(
      { error: 'No se pudo completar el onboarding.' },
      { status: 500 },
    )
  }
}
