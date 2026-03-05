// ─── Organization model ────────────────────────────────────────────────────────
// Each org is a separate tenant. JVF Inversiones SRL is seeded as 'org_001'.

export interface Organization {
  _id:                   string   // 'org_001', 'org_002', etc.
  name:                  string
  plan:                  'starter' | 'pro' | 'enterprise'
  stripeCustomerId?:     string
  stripeSubscriptionId?: string
  createdAt:             string
  updatedAt:             string
}
