export function getStripePublishableKey(env: NodeJS.ProcessEnv = process.env) {
  return env.STRIPE_PUBLISHABLE_KEY?.trim() || ''
}

export function getStripeSecretKey(env: NodeJS.ProcessEnv = process.env) {
  return env.STRIPE_SECRET_KEY?.trim() || ''
}

export function assertStripeSecretEnv(env: NodeJS.ProcessEnv = process.env) {
  if (!getStripeSecretKey(env)) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }
}

export function assertStripePublishableEnv(env: NodeJS.ProcessEnv = process.env) {
  if (!getStripePublishableKey(env)) {
    throw new Error('Missing STRIPE_PUBLISHABLE_KEY')
  }
}

export function assertStripeEnv(env: NodeJS.ProcessEnv = process.env) {
  assertStripeSecretEnv(env)
  assertStripePublishableEnv(env)
}

export const STRIPE_CONFIG = {
  secretKey: getStripeSecretKey(),
  publishableKey: getStripePublishableKey(),
}
