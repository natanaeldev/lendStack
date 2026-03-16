import test from 'node:test'
import assert from 'node:assert/strict'
import { getOrganizationCreationEndpoint } from '../src/lib/organizationFlow.ts'

test('authenticated users create organizations through the dedicated endpoint', () => {
  assert.equal(getOrganizationCreationEndpoint(true), '/api/organizations')
})

test('unauthenticated users still use register onboarding endpoint', () => {
  assert.equal(getOrganizationCreationEndpoint(false), '/api/register')
})
