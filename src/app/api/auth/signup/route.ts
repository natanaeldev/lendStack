import { NextRequest, NextResponse } from 'next/server'
import { getDb, getMongoClient, isDbConfigured } from '@/lib/mongodb'
import { OnboardingConflictError, OnboardingValidationError, runSelfServiceOnboarding } from '@/lib/selfServiceOnboarding'

function inferOrganizationName(name: string, email: string) {
  const cleanName = name.trim()
  if (cleanName) return `${cleanName} Workspace`
  const localPart = email.trim().split('@')[0] || 'Nuevo'
  return `${localPart} Workspace`
}

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const email = body.email ?? ''
    const fullName = body.name ?? body.fullName ?? ''
    const client = await getMongoClient()
    const db = await getDb()

    const result = await runSelfServiceOnboarding(client, db, {
      fullName,
      email,
      password: body.password ?? '',
      organizationName: body.organizationName ?? inferOrganizationName(fullName, email),
      plan: 'starter',
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
    console.error('[POST /api/auth/signup]', error)
    return NextResponse.json({ error: 'No se pudo completar el onboarding.' }, { status: 500 })
  }
}
