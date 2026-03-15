import { NextResponse } from 'next/server'
import { createOrganizationConnectOnboarding, isStripeConnectConfigured } from '@/lib/stripeBilling'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { canManageOrganizationBilling } from '@/lib/billingCore'

export async function POST() {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!canManageOrganizationBilling(session.user.role)) {
    return NextResponse.json({ error: 'No tienes permisos para conectar Stripe.' }, { status: 403 })
  }

  if (!isStripeConnectConfigured()) {
    return NextResponse.json({ error: 'Stripe Connect no está configurado.' }, { status: 503 })
  }

  try {
    const onboarding = await createOrganizationConnectOnboarding({
      organizationId: session.user.organizationId,
      contactEmail: session.user.email ?? '',
    })
    return NextResponse.json(onboarding)
  } catch (error: any) {
    console.error('[POST /api/billing/connect]', error)
    return NextResponse.json({ error: 'No se pudo iniciar la conexión con Stripe.' }, { status: 500 })
  }
}
