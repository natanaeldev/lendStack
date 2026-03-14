import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { MongoClient } from 'mongodb'
import { randomBytes, randomUUID } from 'node:crypto'
import { calculateLoanQuote } from '../src/lib/loanEngine.ts'

const ORG_NAME = 'LendStack Test Organization'
const ORG_SLUG = 'lendstack-test'
const TEST_EMAIL = 'test@lendstack.com'
const TEST_BORROWER = 'Test Borrower'
const PRODUCT_NAME = 'Flat Microloan Test'
const SAMPLE_LOAN_SEED_KEY = 'flat-microloan-test-loan'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function nowIso() {
  return new Date().toISOString()
}

function generateTemporaryPassword() {
  const token = randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 12)
  return `Ls!${token}9a`
}

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

function buildInstallments(loanId, clientId, organizationId, quote) {
  return quote.schedule.map((row) => ({
    _id: randomUUID(),
    organizationId,
    loanId,
    clientId,
    installmentNumber: row.installmentNumber,
    dueDate: row.dueDate,
    periodLabel: `Cuota ${row.installmentNumber}`,
    scheduledPrincipal: row.principalAmount,
    scheduledInterest: row.interestAmount,
    scheduledAmount: row.paymentAmount,
    paidPrincipal: 0,
    paidInterest: 0,
    paidAmount: 0,
    remainingAmount: row.paymentAmount,
    status: 'pending',
    isTest: true,
  }))
}

async function main() {
  const root = process.cwd()
  loadEnvFile(path.join(root, '.env.local'))

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required.')
  }

  const client = await new MongoClient(process.env.MONGODB_URI).connect()
  const db = client.db('jvf')

  const organizations = db.collection('organizations')
  const users = db.collection('users')
  const orgUsers = db.collection('organization_users')
  const loanSettings = db.collection('loan_settings')
  const loanProducts = db.collection('loan_products')
  const clients = db.collection('clients')
  const loans = db.collection('loans')
  const installments = db.collection('installments')

  const now = nowIso()
  const startDate = new Date().toISOString().slice(0, 10)

  let organization = await organizations.findOne({
    $or: [
      { slug: ORG_SLUG },
      { name: ORG_NAME, isTest: true },
    ],
  })

  if (!organization) {
    const organizationId = `org_${randomUUID().replace(/-/g, '').slice(0, 8)}`
    await organizations.insertOne({
      _id: organizationId,
      name: ORG_NAME,
      slug: ORG_SLUG,
      environment: 'test',
      plan: 'starter',
      createdAt: now,
      updatedAt: now,
      isTest: true,
    })
    organization = await organizations.findOne({ _id: organizationId })
  }

  if (!organization) {
    throw new Error('Failed to create or load test organization.')
  }

  let user = await users.findOne({ email: TEST_EMAIL })
  let temporaryPassword = null
  let reusedExistingUser = false
  const warnings = []

  if (!user) {
    temporaryPassword = generateTemporaryPassword()
    const passwordHash = await bcrypt.hash(temporaryPassword, 12)
    await users.insertOne({
      name: 'LendStack Test Admin',
      email: TEST_EMAIL,
      passwordHash,
      role: 'master',
      organizationId: organization._id,
      status: 'active',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      isTest: true,
    })
    user = await users.findOne({ email: TEST_EMAIL })
  } else {
    reusedExistingUser = true
    if (String(user.organizationId ?? '') !== String(organization._id)) {
      warnings.push('Existing user belongs to another organization. Membership was added, but primary organizationId was not overwritten.')
    }
  }

  if (!user) {
    throw new Error('Failed to create or load test user.')
  }

  const existingMembership = await orgUsers.findOne({
    organizationId: organization._id,
    userId: user._id,
  })

  if (!existingMembership) {
    await orgUsers.insertOne({
      _id: randomUUID(),
      organizationId: organization._id,
      userId: user._id,
      role: 'OWNER',
      createdAt: now,
      isTest: true,
    })
  }

  await loanSettings.updateOne(
    { organizationId: organization._id, isTest: true },
    {
      $setOnInsert: {
        _id: randomUUID(),
        organizationId: organization._id,
        defaultCurrency: 'USD',
        roundingMode: 'HALF_UP',
        defaultInterestMethod: 'FLAT_TOTAL',
        createdAt: now,
        isTest: true,
      },
      $set: { updatedAt: now },
    },
    { upsert: true },
  )

  await loanProducts.updateOne(
    { organizationId: organization._id, name: PRODUCT_NAME, isTest: true },
    {
      $setOnInsert: {
        _id: randomUUID(),
        organizationId: organization._id,
        name: PRODUCT_NAME,
        interestMethod: 'FLAT_TOTAL',
        rate: 10,
        paymentFrequency: 'MONTHLY',
        installments: 12,
        currency: 'USD',
        active: true,
        createdAt: now,
        isTest: true,
      },
      $set: { updatedAt: now },
    },
    { upsert: true },
  )

  let borrower = await clients.findOne({
    organizationId: organization._id,
    name: TEST_BORROWER,
    isTest: true,
  })

  if (!borrower) {
    const borrowerId = randomUUID()
    await clients.insertOne({
      _id: borrowerId,
      organizationId: organization._id,
      savedAt: now,
      name: TEST_BORROWER,
      email: 'test.borrower@lendstack.test',
      phone: '000-000-0000',
      loanStatus: 'approved',
      lifecycleStatus: 'approved',
      documents: [],
      payments: [],
      branch: null,
      branchId: null,
      branchName: null,
      notes: 'Seeded test borrower for engine validation.',
      isTest: true,
    })
    borrower = await clients.findOne({ _id: borrowerId })
  }

  if (!borrower) {
    throw new Error('Failed to create or load test borrower.')
  }

  const quote = calculateLoanQuote({
    principal: 10000,
    interestMethod: 'FLAT_TOTAL',
    paymentFrequency: 'MONTHLY',
    installmentCount: 12,
    rateValue: 10,
    rateUnit: 'PERCENT',
    startDate,
  })

  const scheduleSum = roundMoney(quote.schedule.reduce((sum, row) => sum + row.paymentAmount, 0))
  if (scheduleSum !== quote.totalPayable) {
    throw new Error(`Schedule reconciliation failed: ${scheduleSum} !== ${quote.totalPayable}`)
  }

  let loan = await loans.findOne({
    organizationId: organization._id,
    clientId: borrower._id,
    isTest: true,
    'metadata.seedKey': SAMPLE_LOAN_SEED_KEY,
    totalPayment: quote.totalPayable,
    totalInterest: quote.totalInterest,
  })

  if (!loan) {
    const loanId = randomUUID()
    await loans.insertOne({
      _id: loanId,
      organizationId: organization._id,
      clientId: borrower._id,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      disbursedAt: now,
      disbursedAmount: 10000,
      loanType: 'carrito',
      currency: 'USD',
      amount: 10000,
      interestMethod: 'FLAT_TOTAL',
      scheduleGenerationMethod: 'EQUAL_INSTALLMENT_LAST_ADJUSTMENT',
      paymentFrequency: 'MONTHLY',
      installmentCount: 12,
      interestPeriodCount: 1,
      rateValue: 10,
      rateUnit: 'PERCENT',
      scheduledPayment: quote.periodicPayment,
      totalPayment: quote.totalPayable,
      totalInterest: quote.totalInterest,
      totalMonths: 12,
      startDate,
      paidPrincipal: 0,
      paidInterest: 0,
      paidTotal: 0,
      remainingBalance: quote.totalPayable,
      notes: 'Seeded test loan for loan-engine validation.',
      metadata: {
        seedKey: SAMPLE_LOAN_SEED_KEY,
        borrowerName: TEST_BORROWER,
      },
      isTest: true,
    })

    await installments.insertMany(buildInstallments(loanId, borrower._id, organization._id, quote))
    loan = await loans.findOne({ _id: loanId })
  }

  if (!loan) {
    throw new Error('Failed to create or load test loan.')
  }

  console.log(JSON.stringify({
    organizationId: String(organization._id),
    organizationName: organization.name,
    userId: String(user._id),
    email: TEST_EMAIL,
    temporaryPassword,
    reusedExistingUser,
    createdTestLoanId: String(loan._id),
    interestTotal: quote.totalInterest,
    totalPayable: quote.totalPayable,
    periodicPayment: quote.periodicPayment,
    scheduleSum,
    finalInstallment: quote.schedule.at(-1)?.paymentAmount ?? null,
    warnings,
  }, null, 2))

  await client.close()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
