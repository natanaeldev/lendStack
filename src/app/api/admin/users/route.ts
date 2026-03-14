import { NextRequest, NextResponse }           from 'next/server'
import { getDb, isDbConfigured }              from '@/lib/mongodb'
import { requireMaster, forbiddenResponse }   from '@/lib/orgAuth'
import bcrypt                                 from 'bcryptjs'

export async function GET() {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const db = await getDb()
    const users = await db.collection('users')
      .find(
        { organizationId: session.user.organizationId },
        { projection: { passwordHash: 0 } },
      )
      .sort({ createdAt: 1 })
      .toArray()

    return NextResponse.json({
      users: users.map((user) => ({
        id: String(user._id),
        name: user.name ?? '',
        email: user.email ?? '',
        role: user.role ?? 'user',
        createdAt: user.createdAt ?? '',
        allowedBranchIds: user.allowedBranchIds ?? null,
      })),
    })
  } catch (err: any) {
    console.error('[GET /api/admin/users]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const { name, email, password, role: rawRole, allowedBranchIds } = await req.json()

    if (!email?.trim())
      return NextResponse.json({ error: 'El email es obligatorio.' }, { status: 400 })
    if (!password || password.length < 8)
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })

    const allowedRoles = ['user', 'operator', 'manager']
    const role = allowedRoles.includes(rawRole) ? rawRole : 'user'
    const branchAccess: string[] | null = Array.isArray(allowedBranchIds) ? allowedBranchIds : null

    const db = await getDb()
    const col = db.collection('users')

    const exists = await col.findOne({ email: email.trim().toLowerCase() })
    if (exists)
      return NextResponse.json({ error: 'Ya existe un usuario con ese email.' }, { status: 409 })

    const passwordHash = await bcrypt.hash(password, 12)
    const createdAt = new Date().toISOString()

    const result = await col.insertOne({
      name: name?.trim() || 'Usuario',
      email: email.trim().toLowerCase(),
      passwordHash,
      role,
      organizationId: session.user.organizationId,
      createdAt,
      createdBy: session.user.id,
      allowedBranchIds: branchAccess,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: result.insertedId.toString(),
        name: name?.trim() || 'Usuario',
        email: email.trim().toLowerCase(),
        role,
        createdAt,
        allowedBranchIds: branchAccess,
      },
    })
  } catch (err: any) {
    console.error('[POST /api/admin/users]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
