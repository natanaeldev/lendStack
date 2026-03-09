import { NextRequest, NextResponse } from 'next/server'
import { getDb, isDbConfigured }    from '@/lib/mongodb'
import bcrypt                       from 'bcryptjs'
import { randomUUID }               from 'crypto'

// ─── POST /api/register — self-service org + master-user creation ──────────────
export async function POST(req: NextRequest) {
  if (!isDbConfigured())
    return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })

  try {
    const body = await req.json()
    const {
      orgName,
      adminName,
      adminEmail,
      password,
      plan = 'starter',
    } = body as {
      orgName:    string
      adminName?: string
      adminEmail: string
      password:   string
      plan?:      'starter' | 'pro'
    }

    // ── Validation ────────────────────────────────────────────────────────────
    if (!orgName?.trim())
      return NextResponse.json(
        { error: 'El nombre de la organización es obligatorio.' },
        { status: 400 }
      )
    if (!adminEmail?.trim())
      return NextResponse.json({ error: 'El email es obligatorio.' }, { status: 400 })
    if (!password || password.length < 8)
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres.' },
        { status: 400 }
      )
    if (!['starter', 'pro'].includes(plan))
      return NextResponse.json({ error: 'Plan inválido.' }, { status: 400 })

    const db  = await getDb()
    const now = new Date().toISOString()

    // ── Duplicate email check ─────────────────────────────────────────────────
    const existingUser = await db.collection('users').findOne({
      email: adminEmail.trim().toLowerCase(),
    })
    if (existingUser)
      return NextResponse.json(
        { error: 'Ya existe una cuenta con ese email.' },
        { status: 409 }
      )

    // ── Create organization ───────────────────────────────────────────────────
    const orgId = `org_${randomUUID().replace(/-/g, '').slice(0, 8)}`

    await db.collection('organizations').insertOne({
      _id:       orgId as any,
      name:      orgName.trim(),
      plan:      'starter',          // always starts as starter; Stripe upgrades to pro
      createdAt: now,
      updatedAt: now,
    })

    // ── Create master user ────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 12)
    await db.collection('users').insertOne({
      name:           adminName?.trim() || 'Administrador',
      email:          adminEmail.trim().toLowerCase(),
      passwordHash,
      role:           'master',
      organizationId: orgId,
      createdAt:      now,
    })

    // ── Stripe checkout for pro plan (optional) ───────────────────────────────
    if (plan === 'pro' && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID) {
      try {
        const Stripe = (await import('stripe')).default
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-02-24.acacia' as any,
        })

        const appUrl = process.env.NEXTAUTH_URL ?? 'https://jvf-app.vercel.app'

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode:                 'subscription',
          line_items:           [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
          metadata:             { orgId },
          customer_email:       adminEmail.trim().toLowerCase(),
          success_url:          `${appUrl}/login?registered=1&plan=pro`,
          cancel_url:           `${appUrl}/register?canceled=1`,
        })

        return NextResponse.json({ success: true, orgId, checkoutUrl: session.url })
      } catch (stripeErr: any) {
        // Stripe failed → still created the org, just downgrade to starter
        console.error('[register] Stripe error:', stripeErr.message)
        return NextResponse.json({
          success: true,
          orgId,
          warning: 'No se pudo iniciar el pago — quedás en plan Starter por ahora.',
        })
      }
    }

    return NextResponse.json({ success: true, orgId })
  } catch (err: any) {
    console.error('[POST /api/register]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
