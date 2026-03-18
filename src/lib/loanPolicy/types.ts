// ─── Loan Credit Policy Types ─────────────────────────────────────────────────

export interface LoanCreditPolicyRuleSet {
  credit_score_gte:     number
  debt_to_income_lte:   number
  income_gte:           number
}

export interface LoanCreditPolicyRejectRule {
  credit_score_lt:      number
  debt_to_income_gt:    number
  income_lt:            number
}

export interface LoanCreditPolicy {
  _id:                      string
  organizationId:           string
  policy_name:              string
  min_credit_score:         number
  max_debt_to_income_ratio: number
  min_monthly_income:       number
  max_loan_amount:          number
  employment_required:      boolean
  rules: {
    auto_approve:   LoanCreditPolicyRuleSet
    manual_review:  LoanCreditPolicyRuleSet
    auto_reject:    LoanCreditPolicyRejectRule
  }
  is_active:  boolean
  createdAt:  string
  updatedAt:  string
  createdBy:  string
}

export type LoanCreditDecision = 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED'

export interface LoanCreditEvaluationInput {
  credit_score:          number
  debt_to_income_ratio:  number
  monthly_income:        number
  loan_amount:           number
  is_employed:           boolean
}

export interface LoanCreditEvaluationResult {
  decision:    LoanCreditDecision
  reason:      string
  policy_name: string
}
