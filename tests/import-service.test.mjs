import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import {
  buildImportTemplateCsv,
  parseSpreadsheetBuffer,
  validateImportRows,
} from '../src/lib/loanImport.ts'

function run(name, fn) {
  fn()
  console.log(`PASS ${name}`)
}

run('CSV parsing keeps required columns intact', () => {
  const csv = [
    'borrower_name,email,phone,loan_amount,interest_rate,term_months,start_date,status,notes',
    'Jane Borrower,jane@example.com,+1-555-0100,15000,18,24,2026-04-01,active,Portfolio import',
  ].join('\n')

  const rows = parseSpreadsheetBuffer('import.csv', 'text/csv', Buffer.from(csv, 'utf8'))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].borrower_name, 'Jane Borrower')
  assert.equal(rows[0].status, 'active')
})

run('XLSX parsing reads the first worksheet', () => {
  const worksheet = XLSX.utils.json_to_sheet([
    {
      borrower_name: 'Excel Borrower',
      email: 'excel@example.com',
      phone: '+1-555-0200',
      loan_amount: 22000,
      interest_rate: 12,
      term_months: 18,
      start_date: '2026-05-15',
      status: 'approved',
      notes: 'Loaded from spreadsheet',
    },
  ])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Loans')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  const rows = parseSpreadsheetBuffer(
    'import.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  )

  assert.equal(rows.length, 1)
  assert.equal(rows[0].borrower_name, 'Excel Borrower')
  assert.equal(rows[0].term_months, '18')
})

run('Validation returns preview rows for valid imports', () => {
  const prepared = validateImportRows([
    {
      borrower_name: 'Valid Borrower',
      email: 'valid@example.com',
      phone: '+1-555-0300',
      loan_amount: '10000',
      interest_rate: '24',
      term_months: '12',
      start_date: '2026-06-01',
      status: 'active',
      notes: 'Clean row',
    },
  ])

  assert.equal(prepared.validRows, 1)
  assert.equal(prepared.invalidRows, 0)
  assert.equal(prepared.previewRows.length, 1)
  assert.equal(prepared.previewRows[0].installmentCount, 12)
  assert.equal(prepared.previewRows[0].borrowerName, 'Valid Borrower')
})

run('Validation reports field-level row errors', () => {
  const prepared = validateImportRows([
    {
      borrower_name: '',
      email: 'not-an-email',
      phone: '',
      loan_amount: '-1',
      interest_rate: '150',
      term_months: '0',
      start_date: 'not-a-date',
      status: 'mystery',
      notes: '',
    },
  ])

  assert.equal(prepared.validRows, 0)
  assert.equal(prepared.invalidRows, 1)
  assert.match(prepared.errors.map((error) => error.field).join(','), /borrower_name/)
  assert.match(prepared.errors.map((error) => error.field).join(','), /interest_rate/)
  assert.match(prepared.errors.map((error) => error.field).join(','), /status/)
})

run('Template includes the documented columns', () => {
  const template = buildImportTemplateCsv()
  assert.match(template, /^borrower_name,email,phone,loan_amount,interest_rate,term_months,start_date,status,notes/m)
  assert.match(template, /Jane Borrower/)
})
