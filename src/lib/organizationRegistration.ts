import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import type { Db } from 'mongodb'

export type OrganizationRegistrationErrorCode =
  | 'validation_error'
  | 'existing_user_requires_login'
  | 'existing_user_session_mismatch'
  | 'organization_exists'
  | 'membership_exists'
  | 'incomplete_onboarding'

export type OrganizationRegistrationResult =
  | {
      ok: true
      orgId: string
      createdUser: boolean
      requiresLogin: boolean
      checkoutEligible: boolean
    }
  | {
      ok: false
      status: number
      errorCode: OrganizationRegistrationErrorCode
      error: string
    }

export type AuthenticatedRegistrationUser = {
  id: string
  email: string
  name?: string | null
}

type RegistrationInput = {
  db: Db
  orgName: string
  adminName?: string
  adminEmail: string
  password?: string
  plan?: 'starter' | 'pro'
  authenticatedUser?: AuthenticatedRegistrationUser | null
}

type UserDocument = {
  _id: unknown
  email?: string
  name?: string
  passwordHash?: string
  role?: string
  organizationId?: string
}

type OrganizationDocument = {
  _id: string
  name?: string
  slug?: string
  normalizedName?: string
  ownerUserId?: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function slugifyOrganizationName(name: string): string {
  return normalizeName(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isMissingOwner(org: OrganizationDocument, ownerMembership: unknown, ownerUser: unknown): boolean {
  if (org.ownerUserId) return false
  if (ownerMembership) return false
  if (ownerUser) return false
  return true
}

async function findOrganizationConflict(
  db: Db,
  orgName: string,
  slug: string
): Promise<OrganizationDocument | null> {
  const organizations = db.collection('organizations')
  const normalizedName = normalizeName(orgName)

  const bySlug = await organizations.findOne({
    $or: [
      { slug },
      { normalizedName },
    ],
  })
  if (bySlug) return bySlug as unknown as OrganizationDocument

  const byName = await organizations.findOne({
    name: orgName.trim(),
  }, {
    collation: { locale: 'es', strength: 1 },
  })
  if (byName) return byName as unknown as OrganizationDocument

  return null
}

async function userHasOrganizationMembership(db: Db, userId: unknown, organizationId: string): Promise<boolean> {
  const membership = await db.collection('organization_memberships').findOne({
    organizationId,
    userId: String(userId),
  })
  return !!membership
}

export async function registerOrganization({
  db,
  orgName,
  adminName,
  adminEmail,
  password,
  plan = 'starter',
  authenticatedUser,
}: RegistrationInput): Promise<OrganizationRegistrationResult> {
  if (!orgName?.trim()) {
    return {
      ok: false,
      status: 400,
      errorCode: 'validation_error',
      error: 'El nombre de la organización es obligatorio.',
    }
  }
  if (!adminEmail?.trim()) {
    return {
      ok: false,
      status: 400,
      errorCode: 'validation_error',
      error: 'El email es obligatorio.',
    }
  }
  if (!['starter', 'pro'].includes(plan)) {
    return {
      ok: false,
      status: 400,
      errorCode: 'validation_error',
      error: 'Plan inválido.',
    }
  }

  const normalizedEmail = normalizeEmail(adminEmail)
  const normalizedOrgName = normalizeName(orgName)
  const slug = slugifyOrganizationName(orgName)

  if (!slug) {
    return {
      ok: false,
      status: 400,
      errorCode: 'validation_error',
      error: 'Ingresá un nombre de organización válido.',
    }
  }

  const existingUser = await db.collection('users').findOne({
    email: normalizedEmail,
  }) as UserDocument | null

  const conflictingOrg = await findOrganizationConflict(db, orgName, slug)
  if (conflictingOrg) {
    const ownerMembership = await db.collection('organization_memberships').findOne({
      organizationId: conflictingOrg._id,
      role: 'owner',
    })
    const ownerUser = await db.collection('users').findOne({
      organizationId: conflictingOrg._id,
      role: 'master',
    })

    if (isMissingOwner(conflictingOrg, ownerMembership, ownerUser)) {
      return {
        ok: false,
        status: 409,
        errorCode: 'incomplete_onboarding',
        error: 'Ya existe un alta incompleta para esa organización. Iniciá sesión para retomarla o contactá soporte.',
      }
    }

    if (existingUser) {
      const currentOrgMembership = existingUser.organizationId === conflictingOrg._id
      const explicitMembership = await userHasOrganizationMembership(db, existingUser._id, conflictingOrg._id)

      if (currentOrgMembership || explicitMembership) {
        return {
          ok: false,
          status: 409,
          errorCode: 'membership_exists',
          error: 'Ya pertenecés a esa organización.',
        }
      }
    }

    return {
      ok: false,
      status: 409,
      errorCode: 'organization_exists',
      error: 'Ya existe una organización con ese nombre.',
    }
  }

  if (existingUser) {
    const authenticatedEmail = authenticatedUser?.email ? normalizeEmail(authenticatedUser.email) : null

    if (!authenticatedUser) {
      const incomplete = !existingUser.passwordHash || !existingUser.organizationId
      return {
        ok: false,
        status: 409,
        errorCode: incomplete ? 'incomplete_onboarding' : 'existing_user_requires_login',
        error: incomplete
          ? 'Ya existe una cuenta para ese email. Iniciá sesión para completar el alta de la organización.'
          : 'Ese email ya tiene una cuenta. Iniciá sesión para continuar con la creación de la organización.',
      }
    }

    if (authenticatedEmail !== normalizedEmail || String(existingUser._id) !== authenticatedUser.id) {
      return {
        ok: false,
        status: 409,
        errorCode: 'existing_user_session_mismatch',
        error: 'La sesión activa no coincide con el email que intentás usar como cuenta dueña.',
      }
    }
  } else if (!password || password.length < 8) {
    return {
      ok: false,
      status: 400,
      errorCode: 'validation_error',
      error: 'La contraseña debe tener al menos 8 caracteres.',
    }
  }

  const now = new Date().toISOString()
  const orgId = `org_${randomUUID().replace(/-/g, '').slice(0, 8)}`

  await db.collection('organizations').insertOne({
    _id: orgId as any,
    name: orgName.trim(),
    slug,
    normalizedName: normalizedOrgName,
    plan: 'starter',
    ownerUserId: existingUser ? String(existingUser._id) : null,
    ownerEmail: normalizedEmail,
    createdAt: now,
    updatedAt: now,
  })

  let ownerUserId: string
  let createdUser = false

  if (existingUser) {
    ownerUserId = String(existingUser._id)
    await db.collection('users').updateOne(
      { _id: existingUser._id as any },
      {
        $set: {
          name: adminName?.trim() || existingUser.name || authenticatedUser?.name || 'Administrador',
          email: normalizedEmail,
          role: 'master',
          organizationId: orgId,
          updatedAt: now,
        },
      }
    )
  } else {
    const passwordHash = await bcrypt.hash(password!, 12)
    const result = await db.collection('users').insertOne({
      name: adminName?.trim() || 'Administrador',
      email: normalizedEmail,
      passwordHash,
      role: 'master',
      organizationId: orgId,
      createdAt: now,
      updatedAt: now,
    })

    ownerUserId = result.insertedId.toString()
    createdUser = true

    await db.collection('organizations').updateOne(
      { _id: orgId as any },
      { $set: { ownerUserId, updatedAt: now } }
    )
  }

  const existingMembership = await db.collection('organization_memberships').findOne({
    organizationId: orgId,
    userId: ownerUserId,
  })

  if (existingMembership) {
    return {
      ok: false,
      status: 409,
      errorCode: 'membership_exists',
      error: 'La cuenta ya pertenece a esa organización.',
    }
  }

  await db.collection('organization_memberships').insertOne({
    organizationId: orgId,
    userId: ownerUserId,
    email: normalizedEmail,
    role: 'owner',
    isOwner: true,
    createdAt: now,
    updatedAt: now,
  })

  return {
    ok: true,
    orgId,
    createdUser,
    requiresLogin: createdUser,
    checkoutEligible: plan === 'pro',
  }
}
