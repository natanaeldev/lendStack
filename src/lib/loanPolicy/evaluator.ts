// ─── Loan Credit Policy Evaluator ─────────────────────────────────────────────
// Evaluates a loan application against the active LoanCreditPolicy.
//
// Decision priority:
//   1. Employment required + unemployed          → REJECTED
//   2. Amount above configured max               → MANUAL_REVIEW
//   3. Meets any auto_reject condition           → REJECTED
//   4. Meets ALL auto_approve conditions         → APPROVED
//   5. Meets ALL manual_review conditions        → MANUAL_REVIEW
//   6. Otherwise                                 → REJECTED

import type {
  LoanCreditPolicy,
  LoanCreditEvaluationInput,
  LoanCreditEvaluationResult,
} from './types'

export function evaluateLoanApplication(
  policy: LoanCreditPolicy,
  input:  LoanCreditEvaluationInput,
): LoanCreditEvaluationResult {
  const { credit_score, debt_to_income_ratio, monthly_income, loan_amount, is_employed } = input
  const name = policy.policy_name

  // 1. Employment gate
  if (policy.employment_required && !is_employed) {
    return { decision: 'REJECTED', reason: 'Se requiere empleo activo para calificar.', policy_name: name }
  }

  // 2. Amount above configured max → manual review (not outright rejection)
  if (loan_amount > policy.max_loan_amount) {
    return { decision: 'MANUAL_REVIEW', reason: `El monto solicitado supera el máximo configurado de ${policy.max_loan_amount}.`, policy_name: name }
  }

  // 3. Any auto_reject condition triggers immediate rejection
  const { auto_approve, manual_review, auto_reject } = policy.rules
  if (
    credit_score          <  auto_reject.credit_score_lt  ||
    debt_to_income_ratio  >  auto_reject.debt_to_income_gt ||
    monthly_income        <  auto_reject.income_lt
  ) {
    return { decision: 'REJECTED', reason: 'No cumple los requisitos mínimos de crédito.', policy_name: name }
  }

  // 4. All auto_approve conditions met → approved
  if (
    credit_score          >= auto_approve.credit_score_gte    &&
    debt_to_income_ratio  <= auto_approve.debt_to_income_lte  &&
    monthly_income        >= auto_approve.income_gte
  ) {
    return { decision: 'APPROVED', reason: 'Cumple con todos los criterios de aprobación automática.', policy_name: name }
  }

  // 5. All manual_review conditions met → manual review
  if (
    credit_score          >= manual_review.credit_score_gte    &&
    debt_to_income_ratio  <= manual_review.debt_to_income_lte  &&
    monthly_income        >= manual_review.income_gte
  ) {
    return { decision: 'MANUAL_REVIEW', reason: 'Requiere revisión manual por un agente autorizado.', policy_name: name }
  }

  return { decision: 'REJECTED', reason: 'No cumple los criterios para revisión manual.', policy_name: name }
}
