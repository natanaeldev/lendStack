import { NextRequest, NextResponse } from 'next/server'
import { getDb, getMongoClient, isDbConfigured } from '@/lib/mongodb'
import { OnboardingConflictError, OnboardingValidationError, runSelfServiceOnboarding } from '@/lib/selfServiceOnboarding'

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const client = await getMongoClient()
    const db = await getDb()

    const result = await runSelfServiceOnboarding(client, db, {
      fullName: body.adminName ?? body.fullName ?? '',
      email: body.adminEmail ?? body.email ?? '',
      password: body.password ?? '',
      organizationName: body.orgName ?? body.organizationName ?? '',
      plan: body.plan === 'pro' ? 'pro' : 'starter',
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    if (error instanceof OnboardingValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof OnboardingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error?.code === 11000) {
      return NextResponse.json({ error: 'La cuenta ya fue creada. Iniciá sesión.' }, { status: 409 })
    }
    console.error('[POST /api/register]', error)
    return NextResponse.json({ error: 'No se pudo completar el onboarding.' }, { status: 500 })
  }
}
