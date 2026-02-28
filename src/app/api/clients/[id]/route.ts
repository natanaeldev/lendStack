import { NextRequest, NextResponse } from 'next/server'
import { runQuery, isNeo4jConfigured } from '@/lib/neo4j'

// ─── DELETE /api/clients/[id] ─────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isNeo4jConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    await runQuery(
      'MATCH (c:Client {id: $id}) OPTIONAL MATCH (c)-[]->(n) DETACH DELETE c, n',
      { id: params.id }
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE /api/clients/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
