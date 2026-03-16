import { NextResponse } from 'next/server'
import { getDb, getMongoClient, isDbConfigured } from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { confirmLoanImport } from '@/lib/loanImport'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const db = await getDb()
    const client = await getMongoClient()
    const result = await confirmLoanImport(
      client,
      db,
      session.user.organizationId,
      params.id,
      session.user.id,
    )

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    console.error(`[POST /api/imports/${params.id}/confirm]`, error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
