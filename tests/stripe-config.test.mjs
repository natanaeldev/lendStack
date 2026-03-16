import assert from 'node:assert/strict'
import {
  STRIPE_CONFIG,
  assertStripePublishableEnv,
  assertStripeSecretEnv,
  getStripePublishableKey,
  getStripeSecretKey,
} from '../src/lib/stripe/config.ts'

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

await run('publishable key is read from STRIPE_PUBLISHABLE_KEY', () => {
  const env = {
    STRIPE_PUBLISHABLE_KEY: 'pk_test_publishable',
  }

  assert.equal(getStripePublishableKey(env), 'pk_test_publishable')
})

await run('secret key is read from STRIPE_SECRET_KEY', () => {
  const env = {
    STRIPE_SECRET_KEY: 'sk_test_secret',
  }

  assert.equal(getStripeSecretKey(env), 'sk_test_secret')
})

await run('publishable env assertion fails when STRIPE_PUBLISHABLE_KEY is missing', () => {
  assert.throws(() => assertStripePublishableEnv({}), /Missing STRIPE_PUBLISHABLE_KEY/)
})

await run('secret env assertion fails when STRIPE_SECRET_KEY is missing', () => {
  assert.throws(() => assertStripeSecretEnv({}), /Missing STRIPE_SECRET_KEY/)
})

await run('static stripe config object is safe to import', () => {
  assert.equal(typeof STRIPE_CONFIG.publishableKey, 'string')
  assert.equal(typeof STRIPE_CONFIG.secretKey, 'string')
})
