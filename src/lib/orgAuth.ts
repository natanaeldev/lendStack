// ─── orgAuth.ts — shared auth middleware helpers ───────────────────────────────
// Import and use these in every API route to ensure authentication
// and org-level isolation between tenants.

import { getServerSession } from 'next-auth'
import { authOptions }      from './auth'
import { NextResponse }     from 'next/server'
import type { Session }     from 'next-auth'

/**
 * Returns the current session, or null if not authenticated.
 * Use for any protected route that any authenticated user can access.
 */
export async function requireAuth(): Promise<Session | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session
}

/**
 * Returns the current session only if the user has the 'master' role.
 * Returns null if unauthenticated or not master.
 */
export async function requireMaster(): Promise<Session | null> {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'master') return null
  return session
}

/**
 * Validates that a session's organizationId matches the given value.
 * Use this to prevent cross-tenant data leakage when the org is in the URL.
 */
export function validateOrgAccess(session: Session, organizationId: string): boolean {
  return session.user.organizationId === organizationId
}

/** 401 — Not authenticated */
export function unauthorizedResponse() {
  return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
}

/** 403 — Authenticated but not allowed */
export function forbiddenResponse() {
  return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
}
