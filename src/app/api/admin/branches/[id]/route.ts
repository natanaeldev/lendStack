import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireMaster, forbiddenResponse }  from '@/lib/orgAuth'

// ─── DELETE /api/admin/branches/[id] ─────────────────────────────────────────
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

    // Verify the branch belongs to this org
    const branch = await db.collection('branches').findOne({
      _id:            params.id as any,
      organizationId: orgId,
    })
    if (!branch)
      return NextResponse.json({ error: 'Sucursal no encontrada.' }, { status: 404 })

    // Prevent deletion if any clients are assigned to this branch
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
