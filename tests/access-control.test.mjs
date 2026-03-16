import assert from 'node:assert/strict'
import { deriveAppEntitlements, canAccessAdminRole, canAccessTab } from '../src/lib/appAccess.ts'
import { deriveOrganizationFeatureOverride } from '../src/lib/organizationFeatures.ts'

async function run(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

await run('starter cannot access reports', () => {
  const entitlements = deriveAppEntitlements({
    role: 'user',
    billingStatus: 'not_started',
    billingPlan: 'starter',
  })
  assert.equal(entitlements.canAccessReports, false)
  assert.equal(canAccessTab('reports', entitlements), false)
})

await run('pro can access reports', () => {
  const entitlements = deriveAppEntitlements({
    role: 'user',
    organizationRole: 'MEMBER',
    billingStatus: 'active',
    billingPlan: 'pro',
  })
  assert.equal(entitlements.canAccessReports, true)
  assert.equal(canAccessTab('reports', entitlements), true)
})

await run('testOrganizacion full-access override unlocks reports and branches without faking active billing', () => {
  const featureOverride = deriveOrganizationFeatureOverride({
    slug: 'testorganizacion',
  })
  const entitlements = deriveAppEntitlements({
    role: 'master',
    organizationRole: 'OWNER',
    isOrganizationOwner: true,
    billingStatus: 'pending_checkout',
    billingPlan: 'pro',
    featureOverride,
  })

  assert.equal(featureOverride.fullAccess, true)
  assert.equal(entitlements.allowPremiumFeatures, true)
  assert.equal(entitlements.canAccessReports, true)
  assert.equal(entitlements.canAccessBranches, true)
  assert.equal(entitlements.canAccessAdmin, true)
  assert.equal(canAccessTab('reports', entitlements), true)
  assert.equal(canAccessTab('branches', entitlements), true)
})

await run('owner sees Admin even without premium and non-owner does not', () => {
  assert.equal(canAccessAdminRole('master'), true)
  assert.equal(canAccessAdminRole({ role: 'user', organizationRole: 'OWNER' }), true)
  assert.equal(canAccessAdminRole('admin'), false)

  const ownerStarter = deriveAppEntitlements({
    role: 'user',
    organizationRole: 'OWNER',
    isOrganizationOwner: true,
    billingStatus: 'not_started',
    billingPlan: 'starter',
  })
  const ownerPro = deriveAppEntitlements({
    role: 'master',
    billingStatus: 'active',
    billingPlan: 'pro',
  })
  const managerPro = deriveAppEntitlements({
    role: 'manager',
    billingStatus: 'active',
    billingPlan: 'pro',
  })

  assert.equal(ownerStarter.canAccessAdmin, true)
  assert.equal(ownerStarter.canAccessReports, false)
  assert.equal(ownerPro.canAccessAdmin, true)
  assert.equal(managerPro.canAccessAdmin, false)
  assert.equal(canAccessTab('admin', ownerStarter), true)
  assert.equal(canAccessTab('admin', managerPro), false)
})
