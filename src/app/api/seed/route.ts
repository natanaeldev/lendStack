import { NextResponse }                       from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { requireMaster, forbiddenResponse }  from '@/lib/orgAuth'

const ORG_ID   = 'org_001'
const ORG_NAME = 'JVF Inversiones SRL'

// ─── POST /api/seed ────────────────────────────────────────────────────────────
// Seeds JVF Inversiones as the default organization and backfills
// organizationId on all existing users and clients that lack it.
// Only callable by authenticated master users.
export async function POST() {
  const session = await requireMaster()
  if (!session) return forbiddenResponse()

  if (!isDbConfigured())
    return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 })

  try {
    const db = await getDb()

    // ── 1. Upsert org_001 ──────────────────────────────────────────────────────
    const orgsCol     = db.collection('organizations')
    const existingOrg = await orgsCol.findOne({ _id: ORG_ID as any })
    let   orgCreated  = false

    if (!existingOrg) {
      const now = new Date().toISOString()
      await orgsCol.insertOne({
        _id:       ORG_ID as any,
        name:      ORG_NAME,
        plan:      'starter',
        createdAt: now,
        updatedAt: now,
      })
      orgCreated = true
    }

    // ── 2. Backfill users without organizationId ───────────────────────────────
    const usersResult = await db.collection('users').updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: ORG_ID } }
    )

    // ── 3. Backfill clients without organizationId ────────────────────────────
    const clientsResult = await db.collection('clients').updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: ORG_ID } }
    )

    return NextResponse.json({
      success:        true,
      orgCreated,
      orgId:          ORG_ID,
      orgName:        ORG_NAME,
      usersUpdated:   usersResult.modifiedCount,
      clientsUpdated: clientsResult.modifiedCount,
    })
  } catch (err: any) {
    console.error('[POST /api/seed]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
