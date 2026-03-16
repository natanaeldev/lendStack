import { NextRequest, NextResponse } from 'next/server'
import { getDb, isDbConfigured } from '@/lib/mongodb'
import { requireAuth, unauthorizedResponse } from '@/lib/orgAuth'
import { listLoanImports, prepareImportFromFile, stageLoanImport } from '@/lib/loanImport'

export async function GET() {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false, imports: [] }, { status: 503 })

  try {
    const db = await getDb()
    const imports = await listLoanImports(db, session.user.organizationId)
    return NextResponse.json({ imports })
  } catch (error: any) {
    console.error('[GET /api/imports]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) return unauthorizedResponse()
  if (!isDbConfigured()) return NextResponse.json({ configured: false }, { status: 503 })

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A file upload is required.' }, { status: 400 })
    }

    const prepared = await prepareImportFromFile(file)
    const db = await getDb()
    const staged = await stageLoanImport(db, session.user.organizationId, session.user.id, prepared)

    return NextResponse.json({
      success: true,
      import: staged,
    })
  } catch (error: any) {
    console.error('[POST /api/imports]', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
