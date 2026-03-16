import assert from 'node:assert/strict'
import { deriveAppEntitlements, canAccessAdminRole, canAccessTab } from '../src/lib/appAccess.ts'

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
    billingStatus: 'active',
    billingPlan: 'pro',
  })
  assert.equal(entitlements.canAccessReports, true)
  assert.equal(canAccessTab('reports', entitlements), true)
})

await run('admin visibility is master only and requires premium', () => {
  assert.equal(canAccessAdminRole('master'), true)
  assert.equal(canAccessAdminRole('admin'), false)

  const masterPro = deriveAppEntitlements({
    role: 'master',
    billingStatus: 'active',
    billingPlan: 'pro',
  })
  const managerPro = deriveAppEntitlements({
    role: 'manager',
    billingStatus: 'active',
    billingPlan: 'pro',
  })

  assert.equal(masterPro.canAccessAdmin, true)
  assert.equal(managerPro.canAccessAdmin, false)
  assert.equal(canAccessTab('admin', masterPro), true)
  assert.equal(canAccessTab('admin', managerPro), false)
})
