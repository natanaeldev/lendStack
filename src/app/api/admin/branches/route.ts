import { NextRequest, NextResponse }                        from 'next/server'
import { getDb, isDbConfigured }                           from '@/lib/mongodb'
import { requireAuth, requireMaster,
         unauthorizedResponse, forbiddenResponse }         from '@/lib/orgAuth'
import { v4 as uuidv4 }                                   from 'uuid'

// ─── GET /api/admin/branches — list branches for this org ─────────────────────
// Any authenticated user in the org can read branches (needed for client form).
// Only masters can create or delete branches.
export async function GET() {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const db       = await getDb()
    const branches = await db.collection('branches')
      .find({ organizationId: session.user.organizationId })
      .sort({ createdAt: 1 })
      .toArray()

    return NextResponse.json({
      branches: branches.map(b => ({
        id:        String(b._id),
        name:      b.name,
        type:      b.type,
        createdAt: b.createdAt ?? '',
      })),
    })
  } catch (err: any) {
    console.error('[GET /api/admin/branches]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─── POST /api/admin/branches — create a named branch ────────────────────────
export async function POST(req: NextRequest) {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()
  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const { name, type } = await req.json()

    if (!name?.trim())
      return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 })
    if (!type || !['sede', 'rutas'].includes(type))
      return NextResponse.json({ error: 'El tipo debe ser sede o rutas.' }, { status: 400 })

    const db  = await getDb()
    const col = db.collection('branches')

    // Prevent duplicate names within the same org
    const exists = await col.findOne({
      organizationId: session.user.organizationId,
      name: { $regex: `^${name.trim()}$`, $options: 'i' },
    })
    if (exists)
      return NextResponse.json({ error: 'Ya existe una sucursal con ese nombre.' }, { status: 409 })

    const id        = uuidv4()
    const createdAt = new Date().toISOString()

    await col.insertOne({
      _id:            id as any,
      organizationId: session.user.organizationId,
      name:           name.trim(),
      type,
      createdAt,
    })

    return NextResponse.json({
      success: true,
      branch: { id, name: name.trim(), type, createdAt },
    })
  } catch (err: any) {
    console.error('[POST /api/admin/branches]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
