import { NextResponse } from 'next/server'
import { getDb, isDbConfigured } from '@/lib/mongodb'

// ─── GET /api/auth/check-setup ───────────────────────────────────────────────
// Returns { needsSetup: true } when no master account exists yet.
export async function GET() {
  if (!isDbConfigured())
    return NextResponse.json({ needsSetup: true })

  try {
    const db    = await getDb()
    const count = await db.collection('users').countDocuments({})
    return NextResponse.json({ needsSetup: count === 0 })
  } catch {
    return NextResponse.json({ needsSetup: false })
  }
}
