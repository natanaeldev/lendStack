import { NextRequest, NextResponse }           from 'next/server'
import { ObjectId }                           from 'mongodb'
import { getDb, isDbConfigured }              from '@/lib/mongodb'
import { requireMaster, forbiddenResponse }   from '@/lib/orgAuth'

// ─── DELETE /api/admin/users/[id] — remove a sub-user ────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const db  = await getDb()
    const col = db.collection('users')

    // Resolve _id — users use MongoDB ObjectId
    let targetId: any
    try { targetId = new ObjectId(params.id) } catch { targetId = params.id }

    // Verify target belongs to this org and is not master
    const target = await col.findOne({
      _id:            targetId,
      organizationId: session.user.organizationId,
    })
    if (!target)
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    if (target.role === 'master')
      return NextResponse.json({ error: 'No se puede eliminar la cuenta maestra.' }, { status: 403 })

    await col.deleteOne({ _id: targetId })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE /api/admin/users]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── PATCH /api/admin/users/[id] — reset a sub-user's password ───────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const { password, role, allowedBranchIds } = await req.json()
    const $set: Record<string, any> = {}

    if (password !== undefined) {
      if (!password || password.length < 8)
        return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })
      const bcrypt = (await import('bcryptjs')).default
      $set.passwordHash = await bcrypt.hash(password, 12)
    }

    if (role !== undefined) {
      const ALLOWED = ['user', 'operator', 'manager']
      if (!ALLOWED.includes(role))
        return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 })
      $set.role = role
    }

    // allowedBranchIds: null = all branches; string[] = restricted to those
    if (allowedBranchIds !== undefined) {
      $set.allowedBranchIds = Array.isArray(allowedBranchIds) ? allowedBranchIds : null
    }

    if (Object.keys($set).length === 0)
      return NextResponse.json({ error: 'Sin cambios.' }, { status: 400 })

    // Resolve _id — users use MongoDB ObjectId
    let targetId: any
    try { targetId = new ObjectId(params.id) } catch { targetId = params.id }

    const db  = await getDb()
    const res = await db.collection('users').updateOne(
      { _id: targetId, organizationId: session.user.organizationId, role: { $ne: 'master' } },
      { $set }
    )
    if (res.matchedCount === 0)
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[PATCH /api/admin/users]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
