import assert from 'node:assert/strict'
import { calculateLoanQuote } from '../src/lib/loanEngine.ts'

function sumPayments(schedule) {
  return Math.round(schedule.reduce((sum, row) => sum + (row.paymentAmount ?? row.payment ?? 0), 0) * 100) / 100
}

function run(name, fn) {
  fn()
  console.log(`PASS ${name}`)
}

run('Case A flat total weekly loan', () => {
  const result = calculateLoanQuote({
    principal: 10000,
    interestMethod: 'FLAT_TOTAL',
    paymentFrequency: 'WEEKLY',
    installmentCount: 13,
    rateValue: 10,
    rateUnit: 'PERCENT',
    startDate: '2026-01-01',
  })

  assert.equal(result.totalInterest, 1000)
  assert.equal(result.totalPayable, 11000)
  assert.equal(result.periodicPayment, 846.15)
  assert.equal(sumPayments(result.schedule), 11000)
})

run('Case B flat total monthly keeps same contract total', () => {
  const weekly = calculateLoanQuote({
    principal: 10000,
    interestMethod: 'FLAT_TOTAL',
    paymentFrequency: 'WEEKLY',
    installmentCount: 13,
    rateValue: 10,
    rateUnit: 'PERCENT',
    startDate: '2026-01-01',
  })
  const monthly = calculateLoanQuote({
    principal: 10000,
    interestMethod: 'FLAT_TOTAL',
    paymentFrequency: 'MONTHLY',
    installmentCount: 13,
    rateValue: 10,
    rateUnit: 'PERCENT',
    startDate: '2026-01-01',
  })

  assert.equal(monthly.totalPayable, 11000)
  assert.equal(monthly.totalInterest, 1000)
  assert.equal(monthly.periodicPayment, 846.15)
  assert.notEqual(weekly.schedule[0].dueDate, monthly.schedule[0].dueDate)
})

run('Case C flat per period', () => {
  const result = calculateLoanQuote({
    principal: 10000,
    interestMethod: 'FLAT_PER_PERIOD',
    paymentFrequency: 'WEEKLY',
    installmentCount: 13,
    interestPeriodCount: 13,
    rateValue: 10,
    rateUnit: 'PERCENT',
  })

  assert.equal(result.totalInterest, 13000)
  assert.equal(result.totalPayable, 23000)
})

run('Case D zero interest', () => {
  const result = calculateLoanQuote({
    principal: 12000,
    interestMethod: 'ZERO_INTEREST',
    paymentFrequency: 'MONTHLY',
    installmentCount: 12,
  })

  assert.equal(result.totalInterest, 0)
  assert.equal(result.totalPayable, 12000)
  assert.equal(result.periodicPayment, 1000)
})

run('Case E declining balance closes cleanly', () => {
  const result = calculateLoanQuote({
    principal: 10000,
    interestMethod: 'DECLINING_BALANCE',
    paymentFrequency: 'MONTHLY',
    installmentCount: 12,
    rateValue: 1,
    rateUnit: 'PERCENT',
  })

  assert.equal(result.schedule[0].openingBalance, 10000)
  assert.equal(result.schedule[0].interestAmount, 100)
  assert.equal(result.schedule.at(-1).closingBalance, 0)
  assert.equal(sumPayments(result.schedule), result.totalPayable)
})

run('flat total product remains independent from operational term length', () => {
  const result = calculateLoanQuote({
    principal: 10000,
    interestMethod: 'FLAT_TOTAL',
    paymentFrequency: 'WEEKLY',
    installmentCount: 13,
    interestPeriodCount: 13,
    rateValue: 10,
    rateUnit: 'PERCENT',
  })

  assert.equal(result.totalInterest, 1000)
  assert.equal(result.totalPayable, 11000)
})

run('one installment stays exact', () => {
  const result = calculateLoanQuote({
    principal: 5000,
    interestMethod: 'FLAT_TOTAL',
    paymentFrequency: 'MONTHLY',
    installmentCount: 1,
    rateValue: 5,
    rateUnit: 'PERCENT',
  })

  assert.equal(result.schedule.length, 1)
  assert.equal(result.schedule[0].paymentAmount, 5250)
})

run('small loans and decimal rates keep deterministic sums', () => {
  const result = calculateLoanQuote({
    principal: 100,
    interestMethod: 'FLAT_TOTAL',
    paymentFrequency: 'WEEKLY',
    installmentCount: 3,
    rateValue: 2.5,
    rateUnit: 'PERCENT',
  })

  assert.equal(result.totalInterest, 2.5)
  assert.deepEqual(result.schedule.map((row) => row.paymentAmount), [34.16, 34.16, 34.18])
  assert.equal(sumPayments(result.schedule), 102.5)
})

run('rounding remainder lands on last installment', () => {
  const result = calculateLoanQuote({
    principal: 10000,
    interestMethod: 'ZERO_INTEREST',
    paymentFrequency: 'MONTHLY',
    installmentCount: 3,
  })

  assert.deepEqual(result.schedule.map((row) => row.paymentAmount), [3333.33, 3333.33, 3333.34])
})

run('high installment counts still sum exactly', () => {
  const result = calculateLoanQuote({
    principal: 365,
    interestMethod: 'ZERO_INTEREST',
    paymentFrequency: 'DAILY',
    installmentCount: 365,
  })

  assert.equal(result.totalPayable, 365)
  assert.equal(sumPayments(result.schedule), 365)
  assert.equal(result.schedule.at(-1).closingBalance, 0)
})

run('flat per period schedule matches contract total', () => {
  const result = calculateLoanQuote({
    principal: 10000,
    interestMethod: 'FLAT_PER_PERIOD',
    paymentFrequency: 'WEEKLY',
    installmentCount: 13,
    interestPeriodCount: 13,
    rateValue: 10,
    rateUnit: 'PERCENT',
  })
  assert.equal(sumPayments(result.schedule), 23000)
})
