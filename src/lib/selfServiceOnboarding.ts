import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import type { MongoClient, Db, ClientSession } from 'mongodb'

export interface SelfServiceOnboardingInput {
  fullName: string
  email: string
  password?: string
  organizationName: string
  plan?: 'starter' | 'pro'
  billingInterval?: 'month' | 'year' | null
  requiresCheckout?: boolean
  authenticatedUserId?: string | null
  strictOrganizationConflicts?: boolean
}

export interface SelfServiceOnboardingResult {
  organizationId: string
  organizationSlug: string
  userId: string
  branchId: string
  starterProductId: string
  sampleBorrowerId: string
  sampleLoanId: string
  checkoutUrl?: string | null
}

export interface SelfServiceOnboardingRepository {
  ensureIndexes(): Promise<void>
  withTransaction<T>(runner: () => Promise<T>): Promise<T>
  findUserByEmail(email: string): Promise<any | null>
  findOrganizationBySlug(slug: string): Promise<any | null>
  findOrganizationByName(name: string): Promise<any | null>
  findMembership(organizationId: string, userId: any): Promise<any | null>
  slugExists(slug: string): Promise<boolean>
  insertOrganization(doc: OrgDoc): Promise<OrgDoc>
  updateOrganization(organizationId: string, patch: Record<string, unknown>): Promise<void>
  insertUser(doc: UserDoc): Promise<UserDoc & { _id: any }>
  updateUser(userId: any, patch: Record<string, unknown>): Promise<void>
  insertMembership(doc: MembershipDoc): Promise<MembershipDoc>
  upsertLoanSettings(doc: LoanSettingsDoc): Promise<LoanSettingsDoc>
  insertBranch(doc: BranchDoc): Promise<BranchDoc>
  upsertLoanProduct(doc: LoanProductDoc): Promise<LoanProductDoc & { _id: any }>
  insertClient(doc: ClientDoc): Promise<ClientDoc>
  insertLoan(doc: LoanDoc): Promise<LoanDoc>
  insertInstallments(docs: InstallmentDoc[]): Promise<void>
}

export class OnboardingConflictError extends Error {
  code: string

  constructor(message: string, code = 'conflict') {
    super(message)
    this.name = 'OnboardingConflictError'
    this.code = code
  }
}

export class OnboardingValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OnboardingValidationError'
  }
}

type OrgDoc = {
  _id: string
  name: string
  slug: string
  ownerUserId?: string | null
  ownerEmail: string
  environment: string
  plan: 'starter' | 'pro'
  billingPlan: 'starter' | 'pro'
  billingStatus: 'active' | 'pending_checkout'
  billingInterval: 'month' | 'year' | null
  isPaymentPastDue: boolean
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  stripeConnectedAccountId?: string | null
  stripeConnectStatus?: 'not_connected'
  createdAt: string
  updatedAt: string
  isTest: boolean
}

type UserDoc = {
  _id?: any
  name: string
  email: string
  passwordHash: string
  role: string
  organizationId: string
  status: string
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  isTest: boolean
}

type MembershipDoc = {
  _id: string
  organizationId: string
  userId: any
  role: 'OWNER'
  createdAt: string
  updatedAt?: string
  isTest: boolean
}

type LoanSettingsDoc = {
  _id: string
  organizationId: string
  currency: 'USD'
  roundingMode: 'HALF_UP'
  defaultInterestMethod: 'FLAT_TOTAL'
  timezone: 'America/Santo_Domingo'
  locale: 'es-DO'
  createdAt: string
  updatedAt: string
  isTest: boolean
}

type BranchDoc = {
  _id: string
  organizationId: string
  name: string
  type: 'sede'
  createdAt: string
  isTest: boolean
}

type LoanProductDoc = {
  _id: string
  organizationId: string
  name: string
  interestMethod: 'FLAT_TOTAL'
  rate: number
  paymentFrequency: 'MONTHLY'
  installments: number
  currency: 'USD'
  active: true
  createdAt: string
  updatedAt: string
  isTest: boolean
}

type ClientDoc = {
  _id: string
  organizationId: string
  savedAt: string
  name: string
  email: string
  phone: string
  branch: 'sede'
  branchId: string
  branchName: string
  loanStatus: 'approved'
  lifecycleStatus: 'approved'
  documents: []
  payments: []
  notes: string
  isTest: boolean
}

type LoanDoc = {
  _id: string
  organizationId: string
  clientId: string
  status: 'active'
  createdAt: string
  updatedAt: string
  disbursedAt: string
  disbursedAmount: number
  loanType: 'carrito'
  currency: 'USD'
  amount: number
  interestMethod: 'FLAT_TOTAL'
  scheduleGenerationMethod: 'EQUAL_INSTALLMENT_LAST_ADJUSTMENT'
  paymentFrequency: 'MONTHLY'
  installmentCount: number
  interestPeriodCount: 1
  rateValue: number
  rateUnit: 'PERCENT'
  scheduledPayment: number
  totalPayment: number
  totalInterest: number
  totalMonths: number
  startDate: string
  paidPrincipal: 0
  paidInterest: 0
  paidTotal: 0
  remainingBalance: number
  notes: string
  isTest: boolean
}

type InstallmentDoc = {
  _id: string
  organizationId: string
  loanId: string
  clientId: string
  installmentNumber: number
  dueDate: string
  periodLabel: string
  scheduledPrincipal: number
  scheduledInterest: number
  scheduledAmount: number
  paidPrincipal: 0
  paidInterest: 0
  paidAmount: 0
  remainingAmount: number
  status: 'pending'
  isTest: boolean
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function slugifyOrganizationName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace'
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function addMonthsIso(startDate: string, monthsToAdd: number) {
  const date = new Date(`${startDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Starter loan startDate must be a valid ISO date.')
  }
  date.setMonth(date.getMonth() + monthsToAdd)
  return date.toISOString().slice(0, 10)
}

function allocateRoundedInstallments(total: number, count: number) {
  if (count === 1) return [roundMoney(total)]

  const roundedBase = roundMoney(total / count)
  const installments = Array.from({ length: count }, () => roundedBase)
  installments[count - 1] = roundMoney(total - roundMoney(roundedBase * (count - 1)))
  return installments
}

export function buildTimestampedUpsertDocument<T extends { createdAt?: string; updatedAt?: string }>(doc: T) {
  const { createdAt, updatedAt, ...safePayload } = doc

  return {
    $set: {
      ...safePayload,
      updatedAt: updatedAt ?? new Date().toISOString(),
    },
    $setOnInsert: createdAt ? { createdAt } : {},
  }
}

type TransactionRunner<T> = (session: ClientSession) => Promise<T>

class MongoOnboardingRepository implements SelfServiceOnboardingRepository {
  private activeSession: ClientSession | null = null
  private readonly client: MongoClient
  private readonly db: Db

  constructor(client: MongoClient, db: Db) {
    this.client = client
    this.db = db
  }

  private options() {
    return this.activeSession ? { session: this.activeSession } : undefined
  }

  async ensureIndexes() {
    await Promise.all([
      this.db.collection('users').createIndex({ email: 1 }, { unique: true }),
      this.db.collection('organizations').createIndex({ slug: 1 }, { unique: true }),
      this.db.collection('organization_users').createIndex({ organizationId: 1, userId: 1 }, { unique: true }),
      this.db.collection('loan_settings').createIndex({ organizationId: 1 }, { unique: true }),
      this.db.collection('loan_products').createIndex({ organizationId: 1, name: 1 }, { unique: true }),
    ])
  }

  async withTransaction<T>(runner: () => Promise<T>) {
    const session = this.client.startSession()
    try {
      return await session.withTransaction(async () => {
        this.activeSession = session
        return runner()
      })
    } finally {
      this.activeSession = null
      await session.endSession()
    }
  }

  async findUserByEmail(email: string) {
    return this.db.collection('users').findOne({ email }, this.options())
  }

  async findOrganizationBySlug(slug: string) {
    return this.db.collection('organizations').findOne({ slug }, this.options())
  }

  async findOrganizationByName(name: string) {
    return this.db.collection('organizations').findOne(
      { name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i') },
      this.options(),
    )
  }

  async findMembership(organizationId: string, userId: any) {
    return this.db.collection('organization_users').findOne(
      { organizationId, userId },
      this.options(),
    )
  }

  async slugExists(slug: string) {
    const org = await this.db.collection('organizations').findOne({ slug }, this.options())
    return !!org
  }

  async insertOrganization(doc: OrgDoc) {
    await this.db.collection('organizations').insertOne(doc as any, this.options())
    return doc
  }

  async updateOrganization(organizationId: string, patch: Record<string, unknown>) {
    await this.db.collection('organizations').updateOne(
      { _id: organizationId as any },
      { $set: patch },
      this.options(),
    )
  }

  async insertUser(doc: UserDoc) {
    const result = await this.db.collection('users').insertOne(doc as any, this.options())
    return { ...doc, _id: result.insertedId }
  }

  async updateUser(userId: any, patch: Record<string, unknown>) {
    await this.db.collection('users').updateOne(
      { _id: userId },
      { $set: patch },
      this.options(),
    )
  }

  async insertMembership(doc: MembershipDoc) {
    await this.db.collection('organization_users').insertOne(doc as any, this.options())
    return doc
  }

  async upsertLoanSettings(doc: LoanSettingsDoc) {
    await this.db.collection('loan_settings').updateOne(
      { organizationId: doc.organizationId },
      buildTimestampedUpsertDocument(doc),
      { ...this.options(), upsert: true },
    )
    return doc
  }

  async insertBranch(doc: BranchDoc) {
    await this.db.collection('branches').insertOne(doc as any, this.options())
    return doc
  }

  async upsertLoanProduct(doc: LoanProductDoc) {
    await this.db.collection('loan_products').updateOne(
      { organizationId: doc.organizationId, name: doc.name },
      buildTimestampedUpsertDocument(doc),
      { ...this.options(), upsert: true },
    )
    const created = await this.db.collection('loan_products').findOne(
      { organizationId: doc.organizationId, name: doc.name },
      this.options(),
    )
    return (created as LoanProductDoc & { _id: any } | null) ?? doc
  }

  async insertClient(doc: ClientDoc) {
    await this.db.collection('clients').insertOne(doc as any, this.options())
    return doc
  }

  async insertLoan(doc: LoanDoc) {
    await this.db.collection('loans').insertOne(doc as any, this.options())
    return doc
  }

  async insertInstallments(docs: InstallmentDoc[]) {
    if (docs.length === 0) return
    await this.db.collection('installments').insertMany(docs as any[], this.options())
  }
}

export async function resolveUniqueOrganizationSlug(
  name: string,
  slugExists: (slug: string) => Promise<boolean>,
) {
  const baseSlug = slugifyOrganizationName(name)
  let candidate = baseSlug
  let suffix = 2

  while (await slugExists(candidate)) {
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return candidate
}

export function buildStarterLoanProduct(organizationId: string, now: string, isTest: boolean): LoanProductDoc {
  return {
    _id: randomUUID(),
    organizationId,
    name: 'Flat Microloan Test',
    interestMethod: 'FLAT_TOTAL',
    rate: 10,
    paymentFrequency: 'MONTHLY',
    installments: 12,
    currency: 'USD',
    active: true,
    createdAt: now,
    updatedAt: now,
    isTest,
  }
}

export function buildSampleLoanArtifacts(organizationId: string, clientId: string, now: string, isTest: boolean) {
  const startDate = now.slice(0, 10)
  const principal = 10000
  const installmentCount = 12
  const rateValue = 10
  const totalInterest = roundMoney(principal * (rateValue / 100))
  const totalPayable = roundMoney(principal + totalInterest)
  const paymentParts = allocateRoundedInstallments(totalPayable, installmentCount)
  const principalParts = allocateRoundedInstallments(principal, installmentCount)
  const schedule = paymentParts.map((paymentAmount, index) => {
    const principalAmount = principalParts[index]
    const interestAmount = roundMoney(paymentAmount - principalAmount)
    return {
      installmentNumber: index + 1,
      dueDate: addMonthsIso(startDate, index + 1),
      principalAmount,
      interestAmount,
      paymentAmount,
    }
  })
  const quote = {
    totalInterest: roundMoney(schedule.reduce((sum, row) => sum + row.interestAmount, 0)),
    totalPayable: roundMoney(schedule.reduce((sum, row) => sum + row.paymentAmount, 0)),
    periodicPayment: schedule[0]?.paymentAmount ?? 0,
    schedule,
  }

  const scheduleSum = roundMoney(quote.schedule.reduce((sum, row) => sum + row.paymentAmount, 0))
  if (scheduleSum !== quote.totalPayable) {
    throw new Error(`Starter schedule mismatch: ${scheduleSum} !== ${quote.totalPayable}`)
  }

  const loanId = randomUUID()
  const loan: LoanDoc = {
    _id: loanId,
    organizationId,
    clientId,
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
    installmentCount,
    interestPeriodCount: 1,
    rateValue,
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
    notes: 'Starter sample loan for immediate engine validation.',
    isTest,
  }

  const installments: InstallmentDoc[] = quote.schedule.map((row) => ({
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
    isTest,
  }))

  return {
    loan,
    installments,
    quote,
  }
}

function validateInput(input: SelfServiceOnboardingInput, hasExistingUser: boolean) {
  if (!input.fullName.trim()) throw new OnboardingValidationError('El nombre completo es obligatorio.')
  if (!input.organizationName.trim()) throw new OnboardingValidationError('El nombre de la organización es obligatorio.')
  if (!input.email.trim()) throw new OnboardingValidationError('El email es obligatorio.')
  if (!hasExistingUser && (!input.password || input.password.length < 8)) {
    throw new OnboardingValidationError('La contraseña debe tener al menos 8 caracteres.')
  }
}

export async function runSelfServiceOnboarding(
  client: MongoClient,
  db: Db,
  input: SelfServiceOnboardingInput,
): Promise<SelfServiceOnboardingResult> {
  const repository = new MongoOnboardingRepository(client, db)
  return runSelfServiceOnboardingWithRepository(repository, input, { nodeEnv: process.env.NODE_ENV })
}

export async function runSelfServiceOnboardingWithRepository(
  repository: SelfServiceOnboardingRepository,
  input: SelfServiceOnboardingInput,
  options: { nodeEnv?: string } = {},
): Promise<SelfServiceOnboardingResult> {
  const email = normalizeEmail(input.email)
  const requestedSlug = slugifyOrganizationName(input.organizationName)
  const existingUser = await repository.findUserByEmail(email)
  validateInput(input, Boolean(existingUser))
  await repository.ensureIndexes()

  if (input.strictOrganizationConflicts) {
    const repositoryWithConflicts = repository as SelfServiceOnboardingRepository & {
      findOrganizationBySlug?: (slug: string) => Promise<any | null>
      findOrganizationByName?: (name: string) => Promise<any | null>
      findMembership?: (organizationId: string, userId: any) => Promise<any | null>
    }
    const existingOrgBySlug = repositoryWithConflicts.findOrganizationBySlug
      ? await repositoryWithConflicts.findOrganizationBySlug(requestedSlug)
      : null
    const existingOrgByName = repositoryWithConflicts.findOrganizationByName
      ? await repositoryWithConflicts.findOrganizationByName(input.organizationName)
      : null
    const conflictingOrganization = existingOrgBySlug ?? existingOrgByName

    if (conflictingOrganization) {
      const ownerMembership = conflictingOrganization.ownerUserId
        ? await repositoryWithConflicts.findMembership?.(conflictingOrganization._id, conflictingOrganization.ownerUserId)
        : null

      if (!conflictingOrganization.ownerUserId && !ownerMembership) {
        throw new OnboardingConflictError(
          'Ya existe un alta incompleta para esa organización. Inicia sesión para retomarla o contacta soporte.',
          'incomplete_onboarding',
        )
      }

      if (existingUser) {
        const membership = await repositoryWithConflicts.findMembership?.(conflictingOrganization._id, existingUser._id)
        if (membership || String(existingUser.organizationId ?? '') === String(conflictingOrganization._id)) {
          throw new OnboardingConflictError('Ya perteneces a esa organización.', 'membership_exists')
        }
      }

      throw new OnboardingConflictError('Ya existe una organización con ese nombre.', 'organization_exists')
    }
  }

  if (existingUser) {
    if (!input.strictOrganizationConflicts) {
      throw new OnboardingConflictError('Ya existe una cuenta con ese email.')
    }

    if (!input.authenticatedUserId) {
      throw new OnboardingConflictError(
        'Ese email ya tiene una cuenta. Inicia sesión para continuar con la creación de la organización.',
        'existing_user_requires_login',
      )
    }

    if (String(existingUser._id) !== String(input.authenticatedUserId)) {
      throw new OnboardingConflictError(
        'La sesión activa no coincide con el email que intentas usar como cuenta dueña.',
        'existing_user_session_mismatch',
      )
    }
  }

  const now = new Date().toISOString()
  const isNonProduction = (options.nodeEnv ?? 'development') !== 'production'
  const isTestWorkspace = isNonProduction || email === 'test@lendstack.com'
  const environment = isNonProduction ? 'test' : 'production'
  const emailVerified = isNonProduction
  const passwordHash = existingUser ? null : await bcrypt.hash(input.password!, 12)

  return repository.withTransaction(async () => {
    const organizationSlug = input.strictOrganizationConflicts
      ? requestedSlug
      : await resolveUniqueOrganizationSlug(input.organizationName, (slug) => repository.slugExists(slug))
    const organizationId = `org_${randomUUID().replace(/-/g, '').slice(0, 8)}`
    const organization = await repository.insertOrganization({
      _id: organizationId,
      name: input.organizationName.trim(),
      slug: organizationSlug,
      ownerUserId: null,
      ownerEmail: email,
      environment,
      plan: 'starter',
      billingPlan: input.plan === 'pro' ? 'pro' : 'starter',
      billingStatus: input.requiresCheckout ? 'pending_checkout' : 'active',
      billingInterval: input.requiresCheckout ? input.billingInterval ?? 'month' : null,
      isPaymentPastDue: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeConnectedAccountId: null,
      stripeConnectStatus: 'not_connected',
      createdAt: now,
      updatedAt: now,
      isTest: isTestWorkspace,
    })

    let userId: any
    if (existingUser) {
      userId = existingUser._id
      await repository.updateUser(existingUser._id, {
        name: input.fullName.trim() || existingUser.name || 'Administrador',
        email,
        role: 'master',
        organizationId: organization._id,
        status: 'active',
        updatedAt: now,
      })
    } else {
      const user = await repository.insertUser({
        name: input.fullName.trim(),
        email,
        passwordHash: passwordHash!,
        role: 'master',
        organizationId: organization._id,
        status: 'active',
        emailVerified,
        createdAt: now,
        updatedAt: now,
        isTest: isTestWorkspace,
      })
      userId = user._id
    }

    await repository.updateOrganization(organization._id, {
      ownerUserId: String(userId),
      updatedAt: now,
    })

    await repository.insertMembership({
      _id: randomUUID(),
      organizationId: organization._id,
      userId,
      role: 'OWNER',
      createdAt: now,
      updatedAt: now,
      isTest: isTestWorkspace,
    })

    await repository.upsertLoanSettings({
      _id: randomUUID(),
      organizationId: organization._id,
      currency: 'USD',
      roundingMode: 'HALF_UP',
      defaultInterestMethod: 'FLAT_TOTAL',
      timezone: 'America/Santo_Domingo',
      locale: 'es-DO',
      createdAt: now,
      updatedAt: now,
      isTest: isTestWorkspace,
    })

    const branch = await repository.insertBranch({
      _id: randomUUID(),
      organizationId: organization._id,
      name: 'Sucursal Principal',
      type: 'sede',
      createdAt: now,
      isTest: isTestWorkspace,
    })

    const starterProduct = await repository.upsertLoanProduct(
      buildStarterLoanProduct(organization._id, now, isTestWorkspace),
    )

    const borrowerId = randomUUID()
    await repository.insertClient({
      _id: borrowerId,
      organizationId: organization._id,
      savedAt: now,
      name: 'Test Borrower',
      email: 'test.borrower@lendstack.test',
      phone: '809-000-0000',
      branch: 'sede',
      branchId: branch._id,
      branchName: branch.name,
      loanStatus: 'approved',
      lifecycleStatus: 'approved',
      documents: [],
      payments: [],
      notes: 'Borrower seeded during self-service onboarding.',
      isTest: isTestWorkspace,
    })

    const sampleLoan = buildSampleLoanArtifacts(organization._id, borrowerId, now, isTestWorkspace)
    await repository.insertLoan(sampleLoan.loan)
    await repository.insertInstallments(sampleLoan.installments)

    return {
      organizationId: organization._id,
      organizationSlug,
      userId: String(userId),
      branchId: branch._id,
      starterProductId: String((starterProduct as any)._id ?? starterProduct._id),
      sampleBorrowerId: borrowerId,
      sampleLoanId: sampleLoan.loan._id,
      checkoutUrl: null,
    }
  })
}
