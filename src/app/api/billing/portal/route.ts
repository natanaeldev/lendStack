import { NextResponse } from 'next/server'
import { createOrganizationBillingPortal, isStripeConfigured } from '@/lib/stripeBilling'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { canManageOrganizationBilling } from '@/lib/billingCore'

export async function POST() {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()

  if (!canManageOrganizationBilling(session.user.role)) {
    return NextResponse.json({ error: 'No tienes permisos para gestionar facturación.' }, { status: 403 })
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe no está configurado.' }, { status: 503 })
  }

  try {
    const portal = await createOrganizationBillingPortal(session.user.organizationId)
    return NextResponse.json({ url: portal.url })
  } catch (error: any) {
    console.error('[POST /api/billing/portal]', error)
    return NextResponse.json({ error: 'No se pudo abrir el portal de facturación.' }, { status: 500 })
  }
}
