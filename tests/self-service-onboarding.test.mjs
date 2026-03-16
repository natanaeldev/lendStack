import assert from 'node:assert/strict'
import {
  OnboardingConflictError,
  buildTimestampedUpsertDocument,
  buildSampleLoanArtifacts,
  buildStarterLoanProduct,
  runSelfServiceOnboardingWithRepository,
  slugifyOrganizationName,
} from '../src/lib/selfServiceOnboarding.ts'

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

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

class InMemoryOnboardingRepository {
  constructor(seed = {}, failAt = null) {
    this.failAt = failAt
    this.state = {
      users: seed.users ?? [],
      organizations: seed.organizations ?? [],
      memberships: seed.memberships ?? [],
      settings: seed.settings ?? [],
      branches: seed.branches ?? [],
      loanProducts: seed.loanProducts ?? [],
      clients: seed.clients ?? [],
      loans: seed.loans ?? [],
      installments: seed.installments ?? [],
    }
  }

  async ensureIndexes() {}

  async withTransaction(runner) {
    const snapshot = structuredClone(this.state)
    try {
      return await runner()
    } catch (error) {
      this.state = snapshot
      throw error
    }
  }

  async findUserByEmail(email) {
    return this.state.users.find((user) => user.email === email) ?? null
  }

  async slugExists(slug) {
    return this.state.organizations.some((organization) => organization.slug === slug)
  }

  maybeFail(step) {
    if (this.failAt === step) {
      throw new Error(`Forced failure at ${step}`)
    }
  }

  async insertOrganization(doc) {
    this.maybeFail('insertOrganization')
    this.state.organizations.push(doc)
    return doc
  }

  async updateOrganization(organizationId, patch) {
    this.maybeFail('updateOrganization')
    const organization = this.state.organizations.find((item) => item._id === organizationId)
    if (!organization) throw new Error('Organization not found')
    Object.assign(organization, patch)
  }

  async insertUser(doc) {
    this.maybeFail('insertUser')
    const created = { ...doc, _id: `user_${this.state.users.length + 1}` }
    this.state.users.push(created)
    return created
  }

  async insertMembership(doc) {
    this.maybeFail('insertMembership')
    this.state.memberships.push(doc)
    return doc
  }

  async upsertLoanSettings(doc) {
    this.maybeFail('upsertLoanSettings')
    const existing = this.state.settings.find((item) => item.organizationId === doc.organizationId)
    if (existing) {
      const createdAt = existing.createdAt
      Object.assign(existing, doc, { createdAt })
      return existing
    }
    this.state.settings.push(doc)
    return doc
  }

  async insertBranch(doc) {
    this.maybeFail('insertBranch')
    this.state.branches.push(doc)
    return doc
  }

  async upsertLoanProduct(doc) {
    this.maybeFail('upsertLoanProduct')
    const existing = this.state.loanProducts.find((item) => item.organizationId === doc.organizationId && item.name === doc.name)
    if (existing) {
      const createdAt = existing.createdAt
      Object.assign(existing, doc, { createdAt })
      return existing
    }
    this.state.loanProducts.push(doc)
    return doc
  }

  async insertClient(doc) {
    this.maybeFail('insertClient')
    this.state.clients.push(doc)
    return doc
  }

  async insertLoan(doc) {
    this.maybeFail('insertLoan')
    this.state.loans.push(doc)
    return doc
  }

  async insertInstallments(docs) {
    this.maybeFail('insertInstallments')
    this.state.installments.push(...docs)
  }
}

await run('slugify organization names', () => {
  assert.equal(slugifyOrganizationName('LendStack Test Organization'), 'lendstack-test-organization')
  assert.equal(slugifyOrganizationName('Créditos Rápidos SRL'), 'creditos-rapidos-srl')
})

await run('starter loan product keeps expected defaults', () => {
  const product = buildStarterLoanProduct('org_123', '2026-03-14T00:00:00.000Z', true)
  assert.equal(product.name, 'Flat Microloan Test')
  assert.equal(product.interestMethod, 'FLAT_TOTAL')
  assert.equal(product.rate, 10)
  assert.equal(product.paymentFrequency, 'MONTHLY')
  assert.equal(product.installments, 12)
})

await run('sample loan artifacts reconcile exactly', () => {
  const sample = buildSampleLoanArtifacts('org_123', 'client_123', '2026-03-14T00:00:00.000Z', true)
  assert.equal(sample.quote.totalInterest, 1000)
  assert.equal(sample.quote.totalPayable, 11000)
  assert.equal(roundMoney(sample.installments.reduce((sum, item) => sum + item.scheduledAmount, 0)), 11000)
  assert.deepEqual(sample.installments.slice(0, 11).map((item) => item.scheduledAmount), Array(11).fill(916.67))
  assert.equal(sample.installments.at(-1).scheduledAmount, 916.63)
})

await run('successful onboarding creates tenant, owner, settings, product, and sample loan', async () => {
  const repository = new InMemoryOnboardingRepository()
  const result = await runSelfServiceOnboardingWithRepository(repository, {
    fullName: 'Test Owner',
    email: 'test@lendstack.com',
    password: 'Test1234!',
    organizationName: 'LendStack Test Organization',
    plan: 'starter',
  }, { nodeEnv: 'test' })

  assert.equal(repository.state.users.length, 1)
  assert.equal(repository.state.organizations.length, 1)
  assert.equal(repository.state.memberships.length, 1)
  assert.equal(repository.state.settings.length, 1)
  assert.equal(repository.state.branches.length, 1)
  assert.equal(repository.state.loanProducts.length, 1)
  assert.equal(repository.state.clients.length, 1)
  assert.equal(repository.state.loans.length, 1)
  assert.equal(repository.state.installments.length, 12)
  assert.equal(repository.state.users[0].organizationId, result.organizationId)
  assert.equal(repository.state.memberships[0].role, 'OWNER')
  assert.equal(repository.state.organizations[0].ownerUserId, repository.state.users[0]._id)
  assert.equal(repository.state.organizations[0].ownerEmail, 'test@lendstack.com')
  assert.equal(repository.state.loanProducts[0].interestMethod, 'FLAT_TOTAL')
  assert.equal(repository.state.loans[0].totalPayment, 11000)
  assert.equal(result.sampleLoanId, repository.state.loans[0]._id)
})

await run('existing email cannot create duplicate account', async () => {
  const repository = new InMemoryOnboardingRepository({
    users: [{ _id: 'user_1', email: 'test@lendstack.com' }],
  })

  await assert.rejects(
    () => runSelfServiceOnboardingWithRepository(repository, {
      fullName: 'Duplicate User',
      email: 'test@lendstack.com',
      password: 'Test1234!',
      organizationName: 'Duplicate Org',
      plan: 'starter',
    }, { nodeEnv: 'test' }),
    OnboardingConflictError,
  )
})

await run('slug collision resolves safely', async () => {
  const repository = new InMemoryOnboardingRepository({
    organizations: [{ _id: 'org_existing', slug: 'lendstack-test-organization' }],
  })

  const result = await runSelfServiceOnboardingWithRepository(repository, {
    fullName: 'Owner',
    email: 'owner@example.com',
    password: 'Test1234!',
    organizationName: 'LendStack Test Organization',
    plan: 'starter',
  }, { nodeEnv: 'test' })

  assert.equal(result.organizationSlug, 'lendstack-test-organization-2')
})

await run('rollback restores clean state when onboarding fails mid-transaction', async () => {
  const repository = new InMemoryOnboardingRepository({}, 'insertLoan')

  await assert.rejects(
    () => runSelfServiceOnboardingWithRepository(repository, {
      fullName: 'Rollback User',
      email: 'rollback@example.com',
      password: 'Test1234!',
      organizationName: 'Rollback Org',
      plan: 'starter',
    }, { nodeEnv: 'test' }),
    /Forced failure at insertLoan/,
  )

  assert.equal(repository.state.users.length, 0)
  assert.equal(repository.state.organizations.length, 0)
  assert.equal(repository.state.memberships.length, 0)
  assert.equal(repository.state.settings.length, 0)
  assert.equal(repository.state.loanProducts.length, 0)
  assert.equal(repository.state.loans.length, 0)
})

await run('duplicate submission does not create duplicate organizations', async () => {
  const repository = new InMemoryOnboardingRepository()

  await runSelfServiceOnboardingWithRepository(repository, {
    fullName: 'First User',
    email: 'first@example.com',
    password: 'Test1234!',
    organizationName: 'First Org',
    plan: 'starter',
  }, { nodeEnv: 'test' })

  await assert.rejects(
    () => runSelfServiceOnboardingWithRepository(repository, {
      fullName: 'First User',
      email: 'first@example.com',
      password: 'Test1234!',
      organizationName: 'First Org',
      plan: 'starter',
    }, { nodeEnv: 'test' }),
    OnboardingConflictError,
  )

  assert.equal(repository.state.organizations.length, 1)
})

await run('timestamped upsert document keeps createdAt only on insert', () => {
  const upsert = buildTimestampedUpsertDocument({
    organizationId: 'org_1',
    locale: 'es-DO',
    createdAt: '2026-03-15T00:00:00.000Z',
    updatedAt: '2026-03-15T00:05:00.000Z',
  })

  assert.equal(upsert.$set.organizationId, 'org_1')
  assert.equal(upsert.$set.locale, 'es-DO')
  assert.equal(upsert.$set.updatedAt, '2026-03-15T00:05:00.000Z')
  assert.equal('createdAt' in upsert.$set, false)
  assert.deepEqual(upsert.$setOnInsert, { createdAt: '2026-03-15T00:00:00.000Z' })
})

await run('loan settings upsert preserves createdAt while updating updatedAt', async () => {
  const repository = new InMemoryOnboardingRepository({
    settings: [{
      _id: 'settings_1',
      organizationId: 'org_1',
      currency: 'USD',
      roundingMode: 'HALF_UP',
      defaultInterestMethod: 'FLAT_TOTAL',
      timezone: 'America/Santo_Domingo',
      locale: 'es-DO',
      createdAt: '2026-03-15T00:00:00.000Z',
      updatedAt: '2026-03-15T00:00:00.000Z',
      isTest: true,
    }],
  })

  const createdAt = repository.state.settings[0].createdAt
  await repository.upsertLoanSettings({
    _id: 'settings_2',
    organizationId: 'org_1',
    currency: 'USD',
    roundingMode: 'HALF_UP',
    defaultInterestMethod: 'FLAT_TOTAL',
    timezone: 'America/Santo_Domingo',
    locale: 'en-US',
    createdAt: '2099-01-01T00:00:00.000Z',
    updatedAt: '2026-03-15T01:00:00.000Z',
    isTest: true,
  })

  assert.equal(repository.state.settings.length, 1)
  assert.equal(repository.state.settings[0].createdAt, createdAt)
  assert.equal(repository.state.settings[0].updatedAt, '2026-03-15T01:00:00.000Z')
  assert.equal(repository.state.settings[0].locale, 'en-US')
})
