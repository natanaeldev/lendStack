import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb, isDbConfigured } from '@/lib/mongodb'

async function requireMaster() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'master') return null
  return session
}

// ─── DELETE /api/admin/users/[id] — remove a sub-user ────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireMaster()
  if (!session)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const db  = await getDb()
    const col = db.collection('users')

    // Safety: never allow deleting the master account
    const target = await col.findOne({ _id: params.id as any })
    if (!target)
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    if (target.role === 'master')
      return NextResponse.json({ error: 'No se puede eliminar la cuenta maestra.' }, { status: 403 })

    await col.deleteOne({ _id: params.id as any })
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
  if (!session)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const { password } = await req.json()
    if (!password || password.length < 8)
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })

    const bcrypt = (await import('bcryptjs')).default
    const passwordHash = await bcrypt.hash(password, 12)

    const db  = await getDb()
    const res = await db.collection('users').updateOne(
      { _id: params.id as any },
      { $set: { passwordHash } }
    )
    if (res.matchedCount === 0)
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[PATCH /api/admin/users]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
