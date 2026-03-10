import { NextRequest, NextResponse }          from 'next/server'
import { getDb, isDbConfigured }             from '@/lib/mongodb'
import { computeDelinquency }               from '@/lib/installmentEngine'
import type { InstallmentDoc }              from '@/lib/loanDomain'

// ─── GET /api/cron/delinquency ─────────────────────────────────────────────────
// Called nightly by Vercel Cron (or manually with the CRON_SECRET header).
// Scans all active/disbursed/delinquent loans, recomputes delinquency from
// their installment schedules, and updates loan status + delinquency fields.
export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel passes it automatically; manual callers must supply it)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isDbConfigured())
    return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const db  = await getDb()
    const now = new Date().toISOString()

    // All loans that could transition to/from delinquent
    const loans = await db.collection('loans')
      .find({ status: { $in: ['active', 'disbursed', 'delinquent'] } })
      .toArray()

    let processed = 0
    let transitioned = 0

    for (const loan of loans) {
      const loanId = String(loan._id)

      const rawInstallments = await db.collection('installments')
        .find({ loanId, organizationId: loan.organizationId })
        .sort({ installmentNumber: 1 })
        .toArray()

      if (rawInstallments.length === 0) continue

      const installments = rawInstallments as unknown as InstallmentDoc[]
      const delinquency  = computeDelinquency(installments)

      let newStatus = loan.status
      if (delinquency.isDelinquent) {
        newStatus = 'delinquent'
      } else if (loan.status === 'delinquent') {
        newStatus = 'active'
      }

      const statusChanged = newStatus !== loan.status

      await db.collection('loans').updateOne(
        { _id: loan._id },
        {
          $set: {
            status:                   newStatus,
            daysPastDue:              delinquency.daysPastDue,
            overdueInstallmentsCount: delinquency.overdueInstallmentsCount,
            overdueAmount:            delinquency.overdueAmount,
            updatedAt:                now,
          },
        },
      )

      processed++
      if (statusChanged) transitioned++
    }

    console.log(`[cron/delinquency] processed=${processed} transitioned=${transitioned}`)
    return NextResponse.json({ success: true, processed, transitioned })
  } catch (err: any) {
    console.error('[GET /api/cron/delinquency]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
