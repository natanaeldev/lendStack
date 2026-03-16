import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAuthenticatedOrganizationCreation, handleRegisterOnboarding } from '../src/lib/organizationApi.ts'
import { OnboardingConflictError, OnboardingValidationError } from '../src/lib/selfServiceOnboarding.ts'

function buildOnboardingResult(overrides: Partial<{
  organizationId: string
  organizationSlug: string
  userId: string
  branchId: string
  starterProductId: string
  sampleBorrowerId: string
  sampleLoanId: string
  checkoutUrl: string | null
}> = {}) {
  return {
    organizationId: 'org_1',
    organizationSlug: 'org-1',
    userId: 'user_1',
    branchId: 'branch_1',
    starterProductId: 'product_1',
    sampleBorrowerId: 'borrower_1',
    sampleLoanId: 'loan_1',
    checkoutUrl: null,
    ...overrides,
  }
}

const activePlan = {
  active: true,
  stripePriceId: 'price_123',
  productKey: 'pro' as const,
  interval: 'month' as const,
}

test('register onboarding rejects authenticated callers', async () => {
  const result = await handleRegisterOnboarding(
    { planKey: 'pro_monthly' },
    {
      getBillingPlanByCheckoutKey: () => activePlan,
      isStripeConfigured: () => true,
      runSelfServiceOnboarding: async () => buildOnboardingResult(),
      createOrganizationCheckoutSession: async () => ({ url: 'https://checkout.test' }),
    },
    { id: 'user_1', email: 'owner@example.com', name: 'Owner' },
  )

  assert.equal(result.status, 400)
  assert.equal(result.body.errorCode, 'use_organization_creation_endpoint')
})

test('register onboarding creates user and organization for unauthenticated flow', async () => {
  const result = await handleRegisterOnboarding(
    {
      adminName: 'Alice',
      adminEmail: 'alice@example.com',
      orgName: 'Acme Lending',
      password: 'supersecret',
      planKey: 'pro_monthly',
    },
    {
      getBillingPlanByCheckoutKey: () => activePlan,
      isStripeConfigured: () => true,
      runSelfServiceOnboarding: async (input) => {
        assert.equal(input.email, 'alice@example.com')
        assert.equal(input.organizationName, 'Acme Lending')
        return buildOnboardingResult()
      },
      createOrganizationCheckoutSession: async () => ({ url: 'https://checkout.test' }),
    },
    null,
  )

  assert.equal(result.status, 200)
  assert.equal(result.body.createdUser, true)
  assert.equal(result.body.requiresLogin, true)
})

test('authenticated organization creation uses current session and returns checkout url', async () => {
  const result = await handleAuthenticatedOrganizationCreation(
    {
      adminName: 'Owner',
      adminEmail: 'owner@example.com',
      orgName: 'New Org',
      planKey: 'pro_monthly',
    },
    {
      getBillingPlanByCheckoutKey: () => activePlan,
      isStripeConfigured: () => true,
      runSelfServiceOnboarding: async (input) => {
        assert.equal(input.email, 'owner@example.com')
        assert.equal(input.authenticatedUserId, 'user_1')
        return buildOnboardingResult({ organizationId: 'org_new' })
      },
      createOrganizationCheckoutSession: async (input) => {
        assert.equal(input.organizationId, 'org_new')
        return { url: 'https://checkout.test/org_new' }
      },
    },
    { id: 'user_1', email: 'owner@example.com', name: 'Owner' },
  )

  assert.equal(result.status, 200)
  assert.equal(result.body.createdUser, false)
  assert.equal(result.body.checkoutUrl, 'https://checkout.test/org_new')
})

test('authenticated organization creation rejects session/email mismatch', async () => {
  const result = await handleAuthenticatedOrganizationCreation(
    {
      adminEmail: 'different@example.com',
      orgName: 'Mismatch Org',
      planKey: 'pro_monthly',
    },
    {
      getBillingPlanByCheckoutKey: () => activePlan,
      isStripeConfigured: () => true,
      runSelfServiceOnboarding: async () => buildOnboardingResult(),
      createOrganizationCheckoutSession: async () => ({ url: 'https://checkout.test' }),
    },
    { id: 'user_1', email: 'owner@example.com', name: 'Owner' },
  )

  assert.equal(result.status, 409)
  assert.equal(result.body.errorCode, 'existing_user_session_mismatch')
})

test('authenticated organization creation returns duplicate org conflict from onboarding service', async () => {
  const result = await handleAuthenticatedOrganizationCreation(
    {
      adminEmail: 'owner@example.com',
      orgName: 'Acme Lending',
      planKey: 'pro_monthly',
    },
    {
      getBillingPlanByCheckoutKey: () => activePlan,
      isStripeConfigured: () => true,
      runSelfServiceOnboarding: async () => {
        throw new OnboardingConflictError('Ya existe una organización con ese nombre.', 'organization_exists')
      },
      createOrganizationCheckoutSession: async () => ({ url: 'https://checkout.test' }),
    },
    { id: 'user_1', email: 'owner@example.com', name: 'Owner' },
  )

  assert.equal(result.status, 409)
  assert.equal(result.body.errorCode, 'organization_exists')
})

test('authenticated organization creation maps validation errors cleanly', async () => {
  const result = await handleAuthenticatedOrganizationCreation(
    {
      adminEmail: 'owner@example.com',
      orgName: '',
      planKey: 'pro_monthly',
    },
    {
      getBillingPlanByCheckoutKey: () => activePlan,
      isStripeConfigured: () => true,
      runSelfServiceOnboarding: async () => {
        throw new OnboardingValidationError('El nombre de la organización es obligatorio.')
      },
      createOrganizationCheckoutSession: async () => ({ url: 'https://checkout.test' }),
    },
    { id: 'user_1', email: 'owner@example.com', name: 'Owner' },
  )

  assert.equal(result.status, 400)
  assert.equal(result.body.errorCode, 'validation_error')
})
