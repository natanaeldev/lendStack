import test from 'node:test'
import assert from 'node:assert/strict'
import { registerOrganization } from '../src/lib/organizationRegistration.ts'

type Doc = Record<string, any>

class FakeCollection {
  name: string
  docs: Doc[]

  constructor(name: string, docs: Doc[]) {
    this.name = name
    this.docs = docs
  }

  async findOne(query: Doc): Promise<Doc | null> {
    return this.docs.find(doc => matchesQuery(doc, query)) ?? null
  }

  async insertOne(doc: Doc): Promise<{ insertedId: string }> {
    const insertedId = doc._id ? String(doc._id) : `${this.name}-${this.docs.length + 1}`
    const stored = { ...doc, _id: doc._id ?? insertedId }
    this.docs.push(stored)
    return { insertedId: String(stored._id) }
  }

  async updateOne(filter: Doc, update: Doc): Promise<{ modifiedCount: number }> {
    const target = this.docs.find(doc => matchesQuery(doc, filter))
    if (!target) return { modifiedCount: 0 }

    if (update.$set) {
      Object.assign(target, update.$set)
    }

    return { modifiedCount: 1 }
  }
}

class FakeDb {
  collections = new Map<string, FakeCollection>()

  collection(name: string): FakeCollection {
    if (!this.collections.has(name)) {
      this.collections.set(name, new FakeCollection(name, []))
    }

    return this.collections.get(name)!
  }
}

function matchesQuery(doc: Doc, query: Doc): boolean {
  return Object.entries(query).every(([key, value]) => {
    if (key === '$or') {
      return (value as Doc[]).some(condition => matchesQuery(doc, condition))
    }

    return doc[key] === value
  })
}

test('new user creates organization, user, and owner membership', async () => {
  const db = new FakeDb()

  const result = await registerOrganization({
    db: db as any,
    orgName: 'Acme Lending',
    adminName: 'Alice Owner',
    adminEmail: 'alice@example.com',
    password: 'supersecret',
    plan: 'starter',
  })

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(result.createdUser, true)
  assert.equal(result.requiresLogin, true)

  const organizations = db.collection('organizations').docs
  const users = db.collection('users').docs
  const memberships = db.collection('organization_memberships').docs

  assert.equal(organizations.length, 1)
  assert.equal(users.length, 1)
  assert.equal(memberships.length, 1)
  assert.equal(organizations[0].slug, 'acme-lending')
  assert.equal(users[0].role, 'master')
  assert.equal(users[0].organizationId, organizations[0]._id)
  assert.equal(memberships[0].role, 'owner')
  assert.equal(memberships[0].organizationId, organizations[0]._id)
})

test('existing logged-in user can create an organization and becomes owner', async () => {
  const db = new FakeDb()
  db.collection('users').docs.push({
    _id: 'user-1',
    email: 'owner@example.com',
    name: 'Existing Owner',
    passwordHash: 'hash',
    role: 'manager',
    organizationId: 'org_old',
  })
  db.collection('organizations').docs.push({
    _id: 'org_old',
    name: 'Old Org',
    slug: 'old-org',
    normalizedName: 'old org',
    ownerUserId: 'user-1',
  })

  const result = await registerOrganization({
    db: db as any,
    orgName: 'Next Org',
    adminName: 'Existing Owner',
    adminEmail: 'owner@example.com',
    plan: 'starter',
    authenticatedUser: {
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Existing Owner',
    },
  })

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(result.createdUser, false)
  assert.equal(result.requiresLogin, false)

  const user = db.collection('users').docs[0]
  const newOrg = db.collection('organizations').docs.find(doc => doc.slug === 'next-org')
  const membership = db.collection('organization_memberships').docs.find(doc => doc.organizationId === newOrg?._id)

  assert.ok(newOrg)
  assert.equal(user.role, 'master')
  assert.equal(user.organizationId, newOrg?._id)
  assert.equal(membership?.role, 'owner')
  assert.equal(membership?.userId, 'user-1')
})

test('duplicate organization slug returns organization-specific error', async () => {
  const db = new FakeDb()
  db.collection('organizations').docs.push({
    _id: 'org_existing',
    name: 'Acme Lending',
    slug: 'acme-lending',
    normalizedName: 'acme lending',
    ownerUserId: 'user-1',
  })
  db.collection('users').docs.push({
    _id: 'user-1',
    email: 'owner@example.com',
    passwordHash: 'hash',
    role: 'master',
    organizationId: 'org_existing',
  })

  const result = await registerOrganization({
    db: db as any,
    orgName: 'Acme Lending',
    adminName: 'Another User',
    adminEmail: 'another@example.com',
    password: 'supersecret',
    plan: 'starter',
  })

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    errorCode: 'organization_exists',
    error: 'Ya existe una organización con ese nombre.',
  })
})

test('duplicate email requires login first and then succeeds after authentication', async () => {
  const db = new FakeDb()
  db.collection('users').docs.push({
    _id: 'user-1',
    email: 'owner@example.com',
    name: 'Existing Owner',
    passwordHash: 'hash',
    role: 'master',
    organizationId: 'org_old',
  })
  db.collection('organizations').docs.push({
    _id: 'org_old',
    name: 'Old Org',
    slug: 'old-org',
    normalizedName: 'old org',
    ownerUserId: 'user-1',
  })

  const firstAttempt = await registerOrganization({
    db: db as any,
    orgName: 'Resume Org',
    adminName: 'Existing Owner',
    adminEmail: 'owner@example.com',
    password: 'supersecret',
    plan: 'starter',
  })

  assert.deepEqual(firstAttempt, {
    ok: false,
    status: 409,
    errorCode: 'existing_user_requires_login',
    error: 'Ese email ya tiene una cuenta. Iniciá sesión para continuar con la creación de la organización.',
  })

  const secondAttempt = await registerOrganization({
    db: db as any,
    orgName: 'Resume Org',
    adminName: 'Existing Owner',
    adminEmail: 'owner@example.com',
    plan: 'starter',
    authenticatedUser: {
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Existing Owner',
    },
  })

  assert.equal(secondAttempt.ok, true)
})

test('retrying org creation for an existing member returns membership-specific error', async () => {
  const db = new FakeDb()
  db.collection('organizations').docs.push({
    _id: 'org_existing',
    name: 'Member Org',
    slug: 'member-org',
    normalizedName: 'member org',
    ownerUserId: 'user-1',
  })
  db.collection('users').docs.push({
    _id: 'user-1',
    email: 'owner@example.com',
    passwordHash: 'hash',
    role: 'master',
    organizationId: 'org_existing',
  })
  db.collection('organization_memberships').docs.push({
    _id: 'membership-1',
    organizationId: 'org_existing',
    userId: 'user-1',
    role: 'owner',
  })

  const result = await registerOrganization({
    db: db as any,
    orgName: 'Member Org',
    adminName: 'Owner',
    adminEmail: 'owner@example.com',
    password: 'supersecret',
    plan: 'starter',
  })

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    errorCode: 'membership_exists',
    error: 'Ya pertenecés a esa organización.',
  })
})
