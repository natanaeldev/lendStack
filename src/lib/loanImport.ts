import { randomUUID } from 'crypto'
import type { ClientSession, Db, MongoClient } from 'mongodb'
import * as XLSX from 'xlsx'
import type { InstallmentDoc, LoanDoc, LoanStatus } from './loanDomain.ts'
import { migrateLegacyStatus, toLegacyStatus } from './loanDomain.ts'
import { calculateLoanQuote } from './loanEngine.ts'

const REQUIRED_COLUMNS = [
  'borrower_name',
  'email',
  'phone',
  'loan_amount',
  'interest_rate',
  'term_months',
  'start_date',
  'status',
  'notes',
] as const

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_ROWS_PER_IMPORT = 5000
const PREVIEW_ROW_LIMIT = 50
const MAX_STORED_ERRORS = 200
const IMPORT_BATCH_SIZE = 250
const STARTER_CLIENT_LIMIT = 50

type RequiredColumn = typeof REQUIRED_COLUMNS[number]

export interface ImportRawRow {
  borrower_name: string
  email: string
  phone: string
  loan_amount: string
  interest_rate: string
  term_months: string
  start_date: string
  status: string
  notes: string
}

export interface RowValidationError {
  rowNumber: number
  field: string
  message: string
}

export interface NormalizedImportRow {
  rowNumber: number
  borrowerName: string
  email: string
  phone: string
  loanAmount: number
  interestRatePercent: number
  termMonths: number
  startDate: string
  status: LoanStatus
  notes: string
}

export interface ImportPreviewRow {
  rowNumber: number
  borrowerName: string
  email: string
  phone: string
  loanAmount: number
  interestRatePercent: number
  termMonths: number
  startDate: string
  status: LoanStatus
  notes: string
  scheduledPayment: number
  totalPayment: number
  totalInterest: number
  installmentCount: number
}

export interface PreparedImport {
  fileName: string
  fileSize: number
  mimeType: string
  totalRows: number
  validRows: number
  invalidRows: number
  previewRows: ImportPreviewRow[]
  errors: RowValidationError[]
  stagedRows: NormalizedImportRow[]
}

export interface ImportHistoryItem {
  id: string
  fileName: string
  sourceFormat: string
  status: string
  totalRows: number
  validRows: number
  invalidRows: number
  importedRows: number
  skippedRows: number
  createdAt: string
  confirmedAt?: string
  completedAt?: string
  createdBy: string
  errorCount: number
  errors: RowValidationError[]
  failureReason?: string
}

type ImportDocument = {
  _id: string
  organizationId: string
  createdBy: string
  fileName: string
  fileSize: number
  mimeType: string
  sourceFormat: 'csv' | 'xlsx'
  status: 'pending_confirmation' | 'importing' | 'completed' | 'failed'
  totalRows: number
  validRows: number
  invalidRows: number
  importedRows: number
  skippedRows: number
  previewRows: ImportPreviewRow[]
  errors: RowValidationError[]
  stagedRows: NormalizedImportRow[]
  createdAt: string
  confirmedAt?: string
  completedAt?: string
  failedAt?: string
  failureReason?: string
}

type OrganizationSummary = {
  _id: string
  plan?: 'starter' | 'pro' | 'enterprise'
}

type BranchSummary = {
  _id: string
  name: string
  type: 'sede' | 'rutas'
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

function limitLength(value: string, maxLength: number) {
  return value.slice(0, maxLength)
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase()
}

function inferSourceFormat(fileName: string, mimeType: string) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.xlsx') || mimeType.includes('sheet')) return 'xlsx'
  return 'csv'
}

function toIsoDate(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/
  if (isoPattern.test(raw)) {
    const date = new Date(`${raw}T12:00:00`)
    return Number.isNaN(date.getTime()) ? '' : raw
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function parsePositiveNumber(raw: string) {
  if (!raw.trim()) return Number.NaN
  const sanitized = raw.replace(/[$,%\s,]/g, '')
  return Number(sanitized)
}

function parsePositiveInteger(raw: string) {
  const parsed = parsePositiveNumber(raw)
  return Number.isInteger(parsed) ? parsed : Number.NaN
}

function normalizeStatus(raw: string): LoanStatus | null {
  const value = raw.trim().toLowerCase()
  if (!value) return 'application_submitted'

  const aliases: Record<string, LoanStatus | 'pending' | 'approved' | 'denied'> = {
    pending: 'pending',
    approved: 'approved',
    denied: 'denied',
    submitted: 'application_submitted',
    application_submitted: 'application_submitted',
    under_review: 'under_review',
    review: 'under_review',
    disbursed: 'disbursed',
    active: 'active',
    delinquent: 'delinquent',
    paid_off: 'paid_off',
    defaulted: 'defaulted',
    cancelled: 'cancelled',
    canceled: 'cancelled',
  }

  const mapped = aliases[value]
  if (!mapped) return null
  return migrateLegacyStatus(mapped)
}

function buildPreviewRow(row: NormalizedImportRow): ImportPreviewRow {
  const annualRateDecimal = row.interestRatePercent / 100
  const monthlyRateDecimal = annualRateDecimal / 12
  const quote = calculateLoanQuote({
    principal: row.loanAmount,
    interestMethod: 'DECLINING_BALANCE',
    installmentCount: row.termMonths,
    paymentFrequency: 'MONTHLY',
    rateValue: monthlyRateDecimal,
    rateUnit: 'DECIMAL',
    startDate: row.startDate,
  })

  return {
    rowNumber: row.rowNumber,
    borrowerName: row.borrowerName,
    email: row.email,
    phone: row.phone,
    loanAmount: row.loanAmount,
    interestRatePercent: row.interestRatePercent,
    termMonths: row.termMonths,
    startDate: row.startDate,
    status: row.status,
    notes: row.notes,
    scheduledPayment: quote.periodicPayment,
    totalPayment: quote.totalPayable,
    totalInterest: quote.totalInterest,
    installmentCount: quote.installmentCount,
  }
}

function toImportRawRow(row: Record<string, unknown>): ImportRawRow {
  return {
    borrower_name: normalizeText(row.borrower_name),
    email: normalizeText(row.email),
    phone: normalizeText(row.phone),
    loan_amount: normalizeText(row.loan_amount),
    interest_rate: normalizeText(row.interest_rate),
    term_months: normalizeText(row.term_months),
    start_date: normalizeText(row.start_date),
    status: normalizeText(row.status),
    notes: normalizeText(row.notes),
  }
}

export function parseSpreadsheetBuffer(fileName: string, mimeType: string, buffer: Buffer): ImportRawRow[] {
  const format = inferSourceFormat(fileName, mimeType)
  const workbook =
    format === 'xlsx'
      ? XLSX.read(buffer, { type: 'buffer', dense: true })
      : XLSX.read(buffer.toString('utf8'), { type: 'string', dense: true })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('The uploaded file does not contain any sheets or rows.')
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
    raw: false,
  })

  return rows.map((row) => {
    const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
    return toImportRawRow(Object.fromEntries(normalizedEntries))
  })
}

export function validateImportRows(rows: ImportRawRow[]): PreparedImport {
  const errors: RowValidationError[] = []
  const stagedRows: NormalizedImportRow[] = []

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const borrowerName = limitLength(normalizeText(row.borrower_name), 120)
    const email = limitLength(normalizeEmail(row.email), 320)
    const phone = limitLength(normalizeText(row.phone), 40)
    const loanAmount = parsePositiveNumber(row.loan_amount)
    const interestRatePercent = parsePositiveNumber(row.interest_rate)
    const termMonths = parsePositiveInteger(row.term_months)
    const startDate = toIsoDate(row.start_date)
    const status = normalizeStatus(row.status)
    const notes = limitLength(normalizeText(row.notes), 1000)

    const rowErrors: RowValidationError[] = []

    if (!borrowerName) {
      rowErrors.push({ rowNumber, field: 'borrower_name', message: 'Borrower name is required.' })
    }

    if (!email) {
      rowErrors.push({ rowNumber, field: 'email', message: 'Email is required.' })
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rowErrors.push({ rowNumber, field: 'email', message: 'Email must be a valid email address.' })
    }

    if (!phone) {
      rowErrors.push({ rowNumber, field: 'phone', message: 'Phone is required.' })
    }

    if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
      rowErrors.push({ rowNumber, field: 'loan_amount', message: 'Loan amount must be greater than 0.' })
    }

    if (!Number.isFinite(interestRatePercent) || interestRatePercent < 0 || interestRatePercent > 100) {
      rowErrors.push({ rowNumber, field: 'interest_rate', message: 'Interest rate must be between 0 and 100 percent.' })
    }

    if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 600) {
      rowErrors.push({ rowNumber, field: 'term_months', message: 'Term months must be an integer between 1 and 600.' })
    }

    if (!startDate) {
      rowErrors.push({ rowNumber, field: 'start_date', message: 'Start date must be a valid date.' })
    }

    if (!status) {
      rowErrors.push({ rowNumber, field: 'status', message: 'Status is not supported.' })
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors)
      return
    }

    stagedRows.push({
      rowNumber,
      borrowerName,
      email,
      phone,
      loanAmount,
      interestRatePercent,
      termMonths,
      startDate,
      status: status!,
      notes,
    })
  })

  return {
    fileName: '',
    fileSize: 0,
    mimeType: '',
    totalRows: rows.length,
    validRows: stagedRows.length,
    invalidRows: rows.length - stagedRows.length,
    previewRows: stagedRows.slice(0, PREVIEW_ROW_LIMIT).map(buildPreviewRow),
    errors: errors.slice(0, MAX_STORED_ERRORS),
    stagedRows,
  }
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function buildInstallmentsFromQuote(
  loanId: string,
  clientId: string,
  organizationId: string,
  quote: ReturnType<typeof calculateLoanQuote>,
) {
  return quote.schedule.map<InstallmentDoc>((row) => ({
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
  }))
}

function buildLoanArtifacts(
  importId: string,
  organizationId: string,
  branch: BranchSummary,
  row: NormalizedImportRow,
) {
  const clientId = `import_client_${importId}_${row.rowNumber}`
  const loanId = `import_loan_${importId}_${row.rowNumber}`
  const annualRateDecimal = row.interestRatePercent / 100
  const monthlyRateDecimal = annualRateDecimal / 12
  const quote = calculateLoanQuote({
    principal: row.loanAmount,
    interestMethod: 'DECLINING_BALANCE',
    installmentCount: row.termMonths,
    paymentFrequency: 'MONTHLY',
    rateValue: monthlyRateDecimal,
    rateUnit: 'DECIMAL',
    startDate: row.startDate,
  })
  const now = new Date().toISOString()
  const shouldGenerateSchedule = !['denied', 'cancelled'].includes(row.status)

  const loanDoc: LoanDoc = {
    _id: loanId,
    organizationId,
    clientId,
    status: row.status,
    createdAt: now,
    updatedAt: now,
    loanType: 'amortized',
    currency: 'USD',
    amount: row.loanAmount,
    profile: 'Medium Risk',
    rateMode: 'annual',
    customMonthlyRate: monthlyRateDecimal,
    interestMethod: 'DECLINING_BALANCE',
    scheduleGenerationMethod: 'DECLINING_BALANCE_LAST_PAYMENT_ADJUSTMENT',
    paymentFrequency: 'MONTHLY',
    installmentCount: row.termMonths,
    interestPeriodCount: row.termMonths,
    rateValue: monthlyRateDecimal,
    rateUnit: 'DECIMAL',
    annualRate: annualRateDecimal,
    monthlyRate: monthlyRateDecimal,
    totalMonths: row.termMonths,
    scheduledPayment: quote.periodicPayment,
    totalPayment: quote.totalPayable,
    totalInterest: quote.totalInterest,
    startDate: row.startDate,
    disbursedAt: shouldGenerateSchedule ? `${row.startDate}T00:00:00.000Z` : undefined,
    disbursedAmount: shouldGenerateSchedule ? row.loanAmount : undefined,
    paidPrincipal: 0,
    paidInterest: 0,
    paidTotal: 0,
    remainingBalance: quote.totalPayable,
    notes: row.notes || undefined,
  }

  const clientDoc = {
    _id: clientId,
    organizationId,
    savedAt: now,
    name: row.borrowerName,
    email: row.email,
    phone: row.phone,
    branch: branch.type,
    branchId: branch._id,
    branchName: branch.name,
    loanStatus: toLegacyStatus(row.status),
    lifecycleStatus: row.status,
    notes: row.notes,
    documents: [],
    payments: [],
    loan: {
      id: loanId,
      loanType: 'amortized',
      interestMethod: 'DECLINING_BALANCE',
      scheduleGenerationMethod: 'DECLINING_BALANCE_LAST_PAYMENT_ADJUSTMENT',
      paymentFrequency: 'MONTHLY',
      installmentCount: row.termMonths,
      interestPeriodCount: row.termMonths,
      amount: row.loanAmount,
      profile: 'Medium Risk',
      currency: 'USD',
      rateMode: 'annual',
      customMonthlyRate: monthlyRateDecimal,
      rateValue: monthlyRateDecimal,
      rateUnit: 'DECIMAL',
      startDate: row.startDate,
      monthlyPayment: quote.periodicPayment,
      totalPayment: quote.totalPayable,
      totalInterest: quote.totalInterest,
      annualRate: annualRateDecimal,
      monthlyRate: monthlyRateDecimal,
      totalMonths: row.termMonths,
      interestRatio: row.loanAmount > 0 ? quote.totalInterest / row.loanAmount : 0,
    },
  }

  const installments: InstallmentDoc[] = shouldGenerateSchedule
    ? buildInstallmentsFromQuote(loanId, clientId, organizationId, quote)
    : []

  return { clientDoc, loanDoc, installments }
}

async function ensureImportIndexes(db: Db) {
  await Promise.all([
    db.collection('loan_imports').createIndex({ organizationId: 1, createdAt: -1 }),
    db.collection('loan_imports').createIndex({ organizationId: 1, status: 1 }),
  ])
}

async function resolveImportContext(db: Db, organizationId: string) {
  const [organization, branch] = await Promise.all([
    db.collection<OrganizationSummary>('organizations').findOne({ _id: organizationId as any }),
    db.collection<BranchSummary>('branches').findOne({ organizationId }, { sort: { createdAt: 1 } }),
  ])

  if (!organization) {
    throw new Error('Organization not found for this session.')
  }

  if (!branch) {
    throw new Error('Create at least one branch before importing loans.')
  }

  return { organization, branch }
}

export async function prepareImportFromFile(file: File) {
  if (!file.name) {
    throw new Error('A file is required.')
  }

  if (file.size === 0) {
    throw new Error('The uploaded file is empty.')
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size exceeds the ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB limit.`)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const rows = parseSpreadsheetBuffer(file.name, file.type, buffer)

  if (rows.length === 0) {
    throw new Error('The uploaded file does not contain any data rows.')
  }

  if (rows.length > MAX_ROWS_PER_IMPORT) {
    throw new Error(`Imports are limited to ${MAX_ROWS_PER_IMPORT} rows per file.`)
  }

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !(column in (rows[0] ?? {})))
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`)
  }

  const prepared = validateImportRows(rows)
  return {
    ...prepared,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
  }
}

export async function stageLoanImport(
  db: Db,
  organizationId: string,
  createdBy: string,
  prepared: PreparedImport,
) {
  await ensureImportIndexes(db)
  await resolveImportContext(db, organizationId)

  const now = new Date().toISOString()
  const importId = randomUUID()
  const doc: ImportDocument = {
    _id: importId,
    organizationId,
    createdBy,
    fileName: prepared.fileName,
    fileSize: prepared.fileSize,
    mimeType: prepared.mimeType,
    sourceFormat: inferSourceFormat(prepared.fileName, prepared.mimeType),
    status: 'pending_confirmation',
    totalRows: prepared.totalRows,
    validRows: prepared.validRows,
    invalidRows: prepared.invalidRows,
    importedRows: 0,
    skippedRows: prepared.invalidRows,
    previewRows: prepared.previewRows,
    errors: prepared.errors,
    stagedRows: prepared.stagedRows,
    createdAt: now,
  }

  await db.collection('loan_imports').insertOne(doc as any)

  return {
    importId,
    fileName: doc.fileName,
    totalRows: doc.totalRows,
    validRows: doc.validRows,
    invalidRows: doc.invalidRows,
    previewRows: doc.previewRows,
    errors: doc.errors,
    maxPreviewRows: PREVIEW_ROW_LIMIT,
  }
}

async function runWithOptionalTransaction<T>(client: MongoClient, runner: (session?: ClientSession) => Promise<T>) {
  const session = client.startSession()
  try {
    return await session.withTransaction(async () => runner(session))
  } catch (error: any) {
    const message = String(error?.message ?? '')
    if (
      message.includes('Transaction numbers are only allowed on a replica set member') ||
      message.includes('Transaction support is not available')
    ) {
      return runner()
    }
    throw error
  } finally {
    await session.endSession()
  }
}

function options(session?: ClientSession) {
  return session ? { session } : undefined
}

export async function confirmLoanImport(
  client: MongoClient,
  db: Db,
  organizationId: string,
  importId: string,
  confirmedBy: string,
) {
  await ensureImportIndexes(db)
  const { organization, branch } = await resolveImportContext(db, organizationId)

  const now = new Date().toISOString()
  const importsCollection = db.collection<ImportDocument>('loan_imports')
  const importDoc = await importsCollection.findOneAndUpdate(
    {
      _id: importId as any,
      organizationId,
      status: 'pending_confirmation',
    },
    {
      $set: {
        status: 'importing',
        confirmedAt: now,
      },
    },
    { returnDocument: 'after' },
  )
  if (!importDoc) {
    throw new Error('Import not found or already processed.')
  }

  if (importDoc.stagedRows.length === 0) {
    await importsCollection.updateOne(
      { _id: importId as any, organizationId },
      {
        $set: {
          status: 'failed',
          failedAt: new Date().toISOString(),
          failureReason: 'No valid rows were available to import.',
        },
      },
    )
    throw new Error('This import does not contain any valid rows.')
  }

  const artifacts = importDoc.stagedRows.map((row) => buildLoanArtifacts(importId, organizationId, branch, row))
  const clientDocs = artifacts.map((artifact) => artifact.clientDoc)
  const loanDocs = artifacts.map((artifact) => artifact.loanDoc)
  const installmentDocs = artifacts.flatMap((artifact) => artifact.installments)

  const currentClientCount = await db.collection('clients').countDocuments({ organizationId })
  if ((organization.plan ?? 'starter') === 'starter' && currentClientCount + clientDocs.length > STARTER_CLIENT_LIMIT) {
    await importsCollection.updateOne(
      { _id: importId as any, organizationId },
      {
        $set: {
          status: 'failed',
          failedAt: new Date().toISOString(),
          failureReason: `Starter plan allows up to ${STARTER_CLIENT_LIMIT} borrowers.`,
        },
      },
    )
    throw new Error(`Starter plan allows up to ${STARTER_CLIENT_LIMIT} borrowers.`)
  }

  try {
    await runWithOptionalTransaction(client, async (session) => {
      for (const batch of chunk(clientDocs, IMPORT_BATCH_SIZE)) {
        await db.collection('clients').insertMany(batch as any[], options(session))
      }
      for (const batch of chunk(loanDocs, IMPORT_BATCH_SIZE)) {
        await db.collection('loans').insertMany(batch as any[], options(session))
      }
      for (const batch of chunk(installmentDocs, IMPORT_BATCH_SIZE)) {
        await db.collection('installments').insertMany(batch as any[], options(session))
      }

      await importsCollection.updateOne(
        { _id: importId as any, organizationId },
        {
          $set: {
            status: 'completed',
            completedAt: new Date().toISOString(),
            completedBy: confirmedBy,
            importedRows: importDoc.stagedRows.length,
            skippedRows: importDoc.invalidRows,
          },
        },
        options(session),
      )
    })
  } catch (error: any) {
    await importsCollection.updateOne(
      { _id: importId as any, organizationId },
      {
        $set: {
          status: 'failed',
          failedAt: new Date().toISOString(),
          failureReason: String(error?.message ?? 'Import failed'),
        },
      },
    )
    throw error
  }

  return {
    importId,
    importedRows: importDoc.stagedRows.length,
    skippedRows: importDoc.invalidRows,
    borrowersCreated: clientDocs.length,
    loansCreated: loanDocs.length,
    installmentsCreated: installmentDocs.length,
  }
}

export async function listLoanImports(db: Db, organizationId: string): Promise<ImportHistoryItem[]> {
  await ensureImportIndexes(db)
  const docs = await db.collection<ImportDocument>('loan_imports')
    .find({ organizationId })
    .sort({ createdAt: -1 })
    .limit(25)
    .toArray()

  return docs.map((doc) => ({
    id: doc._id,
    fileName: doc.fileName,
    sourceFormat: doc.sourceFormat,
    status: doc.status,
    totalRows: doc.totalRows,
    validRows: doc.validRows,
    invalidRows: doc.invalidRows,
    importedRows: doc.importedRows,
    skippedRows: doc.skippedRows,
    createdAt: doc.createdAt,
    confirmedAt: doc.confirmedAt,
    completedAt: doc.completedAt,
    createdBy: doc.createdBy,
    errorCount: doc.errors.length,
    errors: doc.errors,
    failureReason: doc.failureReason,
  }))
}

export function buildImportTemplateCsv() {
  const header = REQUIRED_COLUMNS.join(',')
  const sample = [
    'Jane Borrower',
    'jane@example.com',
    '+1-555-0100',
    '15000',
    '18',
    '24',
    '2026-04-01',
    'active',
    'Imported from portfolio migration',
  ].join(',')

  return `${header}\n${sample}\n`
}
