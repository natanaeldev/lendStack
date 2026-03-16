import test from 'node:test'
import assert from 'node:assert/strict'
import { mapMongoDuplicateKeyToOnboardingConflict } from '../src/lib/onboardingConflicts.ts'

test('maps duplicate user email conflict to sign-in flow', () => {
  const conflict = mapMongoDuplicateKeyToOnboardingConflict({
    code: 11000,
    keyPattern: { email: 1 },
    keyValue: { email: 'owner@example.com' },
    ns: 'jvf.users',
  })

  assert.ok(conflict)
  assert.equal(conflict?.code, 'existing_user_requires_login')
})

test('maps duplicate organization slug conflict to organization_exists', () => {
  const conflict = mapMongoDuplicateKeyToOnboardingConflict({
    code: 11000,
    keyPattern: { slug: 1 },
    keyValue: { slug: 'acme-lending' },
    ns: 'jvf.organizations',
  })

  assert.ok(conflict)
  assert.equal(conflict?.code, 'organization_exists')
})

test('maps duplicate membership conflict to membership_exists', () => {
  const conflict = mapMongoDuplicateKeyToOnboardingConflict({
    code: 11000,
    keyPattern: { organizationId: 1, userId: 1 },
    keyValue: { organizationId: 'org_1', userId: 'user_1' },
    ns: 'jvf.organization_users',
  })

  assert.ok(conflict)
  assert.equal(conflict?.code, 'membership_exists')
})
