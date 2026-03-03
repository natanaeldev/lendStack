import { NextRequest, NextResponse } from 'next/server'
import { getDb, isDbConfigured } from '@/lib/mongodb'
import bcrypt from 'bcryptjs'

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
// Creates the single master account. Rejected if an account already exists.
export async function POST(req: NextRequest) {
  if (!isDbConfigured())
    return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })

  try {
    const { name, email, password } = await req.json()

    if (!email?.trim())
      return NextResponse.json({ error: 'El email es obligatorio.' }, { status: 400 })
    if (!password || password.length < 8)
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })

    const db  = await getDb()
    const col = db.collection('users')

    // Only one master account allowed
    const existing = await col.countDocuments({})
    if (existing > 0)
      return NextResponse.json({ error: 'La cuenta maestra ya existe. Iniciá sesión.' }, { status: 409 })

    const passwordHash = await bcrypt.hash(password, 12)

    await col.insertOne({
      name:         name?.trim() || 'Administrador',
      email:        email.trim().toLowerCase(),
      passwordHash,
      role:         'master',
      createdAt:    new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[POST /api/auth/signup]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
