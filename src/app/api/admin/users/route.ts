import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb, isDbConfigured } from '@/lib/mongodb'
import bcrypt from 'bcryptjs'

// ── Guard: only master role ───────────────────────────────────────────────────
async function requireMaster() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'master') return null
  return session
}

// ─── GET /api/admin/users — list all users ────────────────────────────────────
export async function GET() {
  if (!await requireMaster())
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const db   = await getDb()
    const users = await db.collection('users')
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ createdAt: 1 })
      .toArray()

    return NextResponse.json({
      users: users.map(u => ({
        id:        String(u._id),
        name:      u.name      ?? '',
        email:     u.email     ?? '',
        role:      u.role      ?? 'user',
        createdAt: u.createdAt ?? '',
      })),
    })
  } catch (err: any) {
    console.error('[GET /api/admin/users]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── POST /api/admin/users — create sub-user ──────────────────────────────────
export async function POST(req: NextRequest) {
  if (!await requireMaster())
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const { name, email, password } = await req.json()

    if (!email?.trim())
      return NextResponse.json({ error: 'El email es obligatorio.' }, { status: 400 })
    if (!password || password.length < 8)
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })

    const db  = await getDb()
    const col = db.collection('users')

    const exists = await col.findOne({ email: email.trim().toLowerCase() })
    if (exists)
      return NextResponse.json({ error: 'Ya existe un usuario con ese email.' }, { status: 409 })

    const passwordHash = await bcrypt.hash(password, 12)

    const result = await col.insertOne({
      name:         name?.trim() || 'Usuario',
      email:        email.trim().toLowerCase(),
      passwordHash,
      role:         'user',          // sub-users are never 'master'
      createdAt:    new Date().toISOString(),
      createdBy:    'master',
    })

    return NextResponse.json({
      success: true,
      user: {
        id:        result.insertedId.toString(),
        name:      name?.trim() || 'Usuario',
        email:     email.trim().toLowerCase(),
        role:      'user',
        createdAt: new Date().toISOString(),
      },
    })
  } catch (err: any) {
    console.error('[POST /api/admin/users]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
