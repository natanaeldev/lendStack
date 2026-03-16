/**
 * AWS Secrets Manager client.
 *
 * In production (ECS), secrets are injected as environment variables at
 * container startup — you don't need to call this module for normal operation.
 *
 * Use this module when you need to:
 *   1. Refresh a secret at runtime without a container restart
 *   2. Access secrets in the worker process
 *   3. Rotate a secret programmatically
 *
 * The ECS task execution role handles decryption transparently.
 * This client uses the VPC Interface Endpoint for Secrets Manager,
 * so traffic never leaves the AWS network.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  type GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager'

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
})

// Cache secrets in memory for the lifetime of the container process.
// Avoids repeated API calls for the same secret. Cache is per-process.
const cache = new Map<string, { value: string; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes

async function getRawSecret(secretArn: string): Promise<string> {
  const now = Date.now()
  const cached = cache.get(secretArn)

  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const response: GetSecretValueCommandOutput = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  )

  const value = response.SecretString ?? ''
  cache.set(secretArn, { value, expiresAt: now + CACHE_TTL_MS })
  return value
}

/**
 * Fetch a JSON secret and return a specific key from it.
 * Most secrets are stored as JSON objects: { KEY: "value", ... }
 */
export async function getSecret(
  secretArn: string,
  key: string
): Promise<string> {
  const raw = await getRawSecret(secretArn)
  try {
    const parsed = JSON.parse(raw)
    if (!(key in parsed)) {
      throw new Error(`Key "${key}" not found in secret ${secretArn}`)
    }
    return parsed[key]
  } catch (e: any) {
    if (e.message.includes('Key "')) throw e
    // Secret is a plain string, not JSON
    return raw
  }
}

/**
 * Fetch and parse a full JSON secret object.
 */
export async function getSecretObject<T = Record<string, string>>(
  secretArn: string
): Promise<T> {
  const raw = await getRawSecret(secretArn)
  return JSON.parse(raw) as T
}

/**
 * Clear the in-memory cache for a specific secret.
 * Call this after rotating a secret to force a fresh fetch.
 */
export function invalidateSecret(secretArn: string): void {
  cache.delete(secretArn)
}
