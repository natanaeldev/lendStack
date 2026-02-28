import { NextResponse } from 'next/server'
import { runQuery, isNeo4jConfigured, toNum } from '@/lib/neo4j'

// ─── GET /api/stats ───────────────────────────────────────────────────────────
export async function GET() {
  if (!isNeo4jConfigured())
    return NextResponse.json({ configured: false }, { status: 503 })

  try {
    // Aggregate totals
    const [totals = {}] = await runQuery(`
      MATCH (c:Client)-[:HAS_LOAN]->(l:Loan)
      RETURN
        count(DISTINCT c)       AS totalClients,
        count(l)                AS totalLoans,
        sum(l.amount)           AS totalAmount,
        avg(l.monthlyPayment)   AS avgMonthlyPayment,
        avg(l.amount)           AS avgAmount,
        sum(l.totalInterest)    AS totalInterest
    `)

    // By risk profile
    const byProfile = await runQuery(`
      MATCH (:Client)-[:HAS_LOAN]->(l:Loan)
      RETURN l.profile AS profile,
             count(l)  AS count,
             sum(l.amount) AS totalAmount
      ORDER BY totalAmount DESC
    `)

    // By currency
    const byCurrency = await runQuery(`
      MATCH (:Client)-[:HAS_LOAN]->(l:Loan)
      RETURN l.currency AS currency,
             count(l)   AS count,
             sum(l.amount) AS totalAmount
    `)

    // 5 most recent
    const recentClients = await runQuery(`
      MATCH (c:Client)-[:HAS_LOAN]->(l:Loan)
      RETURN {
        id: c.id, name: c.name, email: c.email, savedAt: c.savedAt,
        amount: l.amount, profile: l.profile,
        currency: l.currency, monthlyPayment: l.monthlyPayment
      } AS client
      ORDER BY c.savedAt DESC
      LIMIT 5
    `)

    return NextResponse.json({
      configured:       true,
      totalClients:     toNum(totals.totalClients),
      totalLoans:       toNum(totals.totalLoans),
      totalAmount:      totals.totalAmount      ?? 0,
      avgMonthlyPayment:totals.avgMonthlyPayment ?? 0,
      avgAmount:        totals.avgAmount         ?? 0,
      totalInterest:    totals.totalInterest     ?? 0,
      byProfile: byProfile.map(r => ({
        profile:     r.profile,
        count:       toNum(r.count),
        totalAmount: r.totalAmount ?? 0,
      })),
      byCurrency: byCurrency.map(r => ({
        currency:    r.currency,
        count:       toNum(r.count),
        totalAmount: r.totalAmount ?? 0,
      })),
      recentClients: recentClients.map(r => r.client),
    })
  } catch (err: any) {
    console.error('[GET /api/stats]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
