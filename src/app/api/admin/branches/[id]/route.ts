import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireMaster, forbiddenResponse }  from '@/lib/orgAuth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const db = await getDb()
    const orgId = session.user.organizationId
    const col = db.collection('branches')

    const current = await col.findOne({
      _id: params.id as any,
      organizationId: orgId,
    })

    if (!current)
      return NextResponse.json({ error: 'Sucursal no encontrada.' }, { status: 404 })

    const exists = await col.findOne({
      _id: { $ne: params.id as any },
      organizationId: orgId,
      name: { $regex: `^${name.trim()}$`, $options: 'i' },
    })

    if (exists)
      return NextResponse.json({ error: 'Ya existe una sucursal con ese nombre.' }, { status: 409 })

    await col.updateOne(
      { _id: params.id as any, organizationId: orgId },
      {
        $set: {
          name: name.trim(),
          type,
          updatedAt: new Date().toISOString(),
        },
      },
    )

    return NextResponse.json({
      success: true,
      branch: {
        id: String(current._id),
        name: name.trim(),
        type,
        createdAt: current.createdAt ?? '',
      },
    })
  } catch (err: any) {
    console.error('[PATCH /api/admin/branches/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin/branches/[id]
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
    const orgId = session.user.organizationId

    const branch = await db.collection('branches').findOne({
      _id:            params.id as any,
      organizationId: orgId,
    })
    if (!branch)
      return NextResponse.json({ error: 'Sucursal no encontrada.' }, { status: 404 })

    const clientCount = await db.collection('clients').countDocuments({
      organizationId: orgId,
      branchId: params.id,
    })
    if (clientCount > 0)
      return NextResponse.json({
        error: `No se puede eliminar: ${clientCount} cliente${clientCount !== 1 ? 's' : ''} asignado${clientCount !== 1 ? 's' : ''} a esta sucursal.`,
        clientCount,
      }, { status: 409 })

    await db.collection('branches').deleteOne({
      _id:            params.id as any,
      organizationId: orgId,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE /api/admin/branches/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
