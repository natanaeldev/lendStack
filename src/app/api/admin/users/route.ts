import { NextRequest, NextResponse }           from 'next/server'
import { getDb, isDbConfigured }              from '@/lib/mongodb'
import { requireMaster, forbiddenResponse }   from '@/lib/orgAuth'
import bcrypt                                 from 'bcryptjs'

// ─── GET /api/admin/users — list users in this org ────────────────────────────
export async function GET() {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const db    = await getDb()
    const users = await db.collection('users')
      .find(
        { organizationId: session.user.organizationId },
        { projection: { passwordHash: 0 } }
      )
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

// ─── POST /api/admin/users — create sub-user in this org ──────────────────────
export async function POST(req: NextRequest) {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const { name, email, password, role: rawRole } = await req.json()

    if (!email?.trim())
      return NextResponse.json({ error: 'El email es obligatorio.' }, { status: 400 })
    if (!password || password.length < 8)
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })

    // Only allow sub-user roles — never 'master'
    const ALLOWED_ROLES = ['user', 'operator', 'manager']
    const role = ALLOWED_ROLES.includes(rawRole) ? rawRole : 'user'

    const db  = await getDb()
    const col = db.collection('users')

    const exists = await col.findOne({ email: email.trim().toLowerCase() })
    if (exists)
      return NextResponse.json({ error: 'Ya existe un usuario con ese email.' }, { status: 409 })

    const passwordHash = await bcrypt.hash(password, 12)

    const result = await col.insertOne({
      name:           name?.trim() || 'Usuario',
      email:          email.trim().toLowerCase(),
      passwordHash,
      role,
      organizationId: session.user.organizationId,
      createdAt:      new Date().toISOString(),
      createdBy:      session.user.id,
    })

    return NextResponse.json({
      success: true,
      user: {
        id:        result.insertedId.toString(),
        name:      name?.trim() || 'Usuario',
        email:     email.trim().toLowerCase(),
        role,
        createdAt: new Date().toISOString(),
      },
    })
  } catch (err: any) {
    console.error('[POST /api/admin/users]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
