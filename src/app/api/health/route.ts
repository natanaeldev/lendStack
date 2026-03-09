import { NextResponse }      from 'next/server'
import { getDb }             from '@/lib/mongodb'
import { isS3Configured }   from '@/lib/s3'
import { isSqsConfigured }  from '@/lib/sqs'

/**
 * GET /api/health
 *
 * ALB and ECS container health check endpoint.
 * Returns 200 when the app is ready to serve traffic.
 * Returns 503 when a critical dependency is unavailable.
 *
 * Keep this FAST — the ALB calls it every 30 seconds.
 * Do not perform heavy operations here.
 *
 * Response shape:
 *   { status: "healthy" | "degraded" | "unhealthy", checks: { ... } }
 */
export async function GET() {
  const checks: Record<string, 'ok' | 'fail' | 'skip'> = {}
  let isHealthy = true

  // ── MongoDB ───────────────────────────────────────────────────────────────
  // A failed DB connection = unhealthy. The app can't function without MongoDB.
  try {
    const db = await getDb()
    await db.command({ ping: 1 })
    checks.mongodb = 'ok'
  } catch {
    checks.mongodb = 'fail'
    isHealthy = false
  }

  // ── S3 ────────────────────────────────────────────────────────────────────
  // Just check configuration — don't make an API call on every health check.
  checks.s3 = isS3Configured() ? 'ok' : 'skip'

  // ── SQS ───────────────────────────────────────────────────────────────────
  checks.sqs = isSqsConfigured() ? 'ok' : 'skip'

  const status = isHealthy ? 'healthy' : 'unhealthy'

  return NextResponse.json(
    {
      status,
      version: process.env.npm_package_version ?? '2.0.0',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: isHealthy ? 200 : 503 }
  )
}
