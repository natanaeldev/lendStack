import assert from 'node:assert/strict'
import { normalizeLoanCharges, summarizeLoanCharges } from '../src/lib/loanCharges.ts'

function run(name, fn) {
  fn()
  console.log(`PASS ${name}`)
}

run('blank and zero-value charges are skipped cleanly', () => {
  const charges = normalizeLoanCharges([
    { type: 'origination_cost', amount: '', financed: true },
    { type: 'gastos_procesales', amount: 0, financed: false },
  ])

  assert.deepEqual(charges, [])
})

run('negative charges are rejected', () => {
  assert.throws(
    () => normalizeLoanCharges([{ type: 'origination_cost', amount: -1, financed: true }]),
    /no puede ser negativo/i,
  )
})

run('charge summary splits financed and upfront amounts', () => {
  const summary = summarizeLoanCharges(10000, [
    { type: 'origination_cost', amount: 250, financed: true },
    { type: 'gastos_procesales', amount: 100, financed: false },
  ])

  assert.deepEqual(summary, {
    financed: 250,
    upfront: 100,
    totalFinancedAmount: 10250,
    netDisbursedAmount: 9900,
  })
})
