export type BillingProductKey = 'starter' | 'pro'
export type BillingPlanInterval = 'month' | 'year'
export type BillingCheckoutKey = 'starter_monthly' | 'starter_yearly' | 'pro_monthly' | 'pro_yearly'

export interface BillingCatalogPlan {
  key: BillingCheckoutKey
  productKey: BillingProductKey
  name: string
  description: string
  interval: BillingPlanInterval
  badge?: string
  amountLabel: string
  features: string[]
  envVar: string
  stripePriceId: string | null
  active: boolean
}

type BillingCatalogSeed = Omit<BillingCatalogPlan, 'stripePriceId' | 'active'>

const PLAN_SEEDS: BillingCatalogSeed[] = [
  {
    key: 'starter_monthly',
    productKey: 'starter',
    name: 'Starter',
    description: 'Base operativa para validar el flujo de cartera y cobranza.',
    interval: 'month',
    badge: 'Operativo',
    amountLabel: 'Starter mensual',
    envVar: 'STRIPE_PRICE_ID_STARTER_MONTHLY',
    features: [
      'Workspace listo para originar y cobrar',
      'Configuración base de préstamos',
      'Reportes y recordatorios operativos',
    ],
  },
  {
    key: 'starter_yearly',
    productKey: 'starter',
    name: 'Starter',
    description: 'Base operativa con facturación anual para validación extendida.',
    interval: 'year',
    badge: 'Ahorro anual',
    amountLabel: 'Starter anual',
    envVar: 'STRIPE_PRICE_ID_STARTER_YEARLY',
    features: [
      'Workspace listo para originar y cobrar',
      'Configuración base de préstamos',
      'Reportes y recordatorios operativos',
    ],
  },
  {
    key: 'pro_monthly',
    productKey: 'pro',
    name: 'Pro',
    description: 'Capacidad premium para equipos y operación intensiva.',
    interval: 'month',
    badge: 'Recomendado',
    amountLabel: 'Pro mensual',
    envVar: 'STRIPE_PRICE_ID_PRO_MONTHLY',
    features: [
      'Clientes y usuarios ilimitados',
      'Dashboard premium y alertas avanzadas',
      'Gestión operativa completa',
    ],
  },
  {
    key: 'pro_yearly',
    productKey: 'pro',
    name: 'Pro',
    description: 'Capacidad premium con ciclo anual.',
    interval: 'year',
    badge: 'Mejor valor',
    amountLabel: 'Pro anual',
    envVar: 'STRIPE_PRICE_ID_PRO_YEARLY',
    features: [
      'Clientes y usuarios ilimitados',
      'Dashboard premium y alertas avanzadas',
      'Gestión operativa completa',
    ],
  },
]

export function getBillingPlanCatalog(env: NodeJS.ProcessEnv = process.env): BillingCatalogPlan[] {
  return PLAN_SEEDS.map((plan) => {
    const stripePriceId = env[plan.envVar]?.trim() || null
    return {
      ...plan,
      stripePriceId,
      active: !!stripePriceId,
    }
  })
}

export function getAvailableBillingPlans(env: NodeJS.ProcessEnv = process.env) {
  return getBillingPlanCatalog(env).filter((plan) => plan.active)
}

export function getStripeBillingPlanDefinitions(env: NodeJS.ProcessEnv = process.env) {
  return getBillingPlanCatalog(env).map((plan) => ({
    key: plan.productKey,
    checkoutKey: plan.key,
    name: `${plan.name} ${plan.interval === 'year' ? 'anual' : 'mensual'}`,
    interval: plan.interval,
    stripePriceId: plan.stripePriceId,
    active: plan.active,
    amountLabel: plan.amountLabel,
    isFree: false,
  }))
}

export function getBillingPlanByCheckoutKey(
  checkoutKey: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!checkoutKey) return null
  return getBillingPlanCatalog(env).find((plan) => plan.key === checkoutKey) ?? null
}

export function getCheckoutKeyFromSelection(productKey: BillingProductKey, interval: BillingPlanInterval) {
  return `${productKey}_${interval === 'year' ? 'yearly' : 'monthly'}` as BillingCheckoutKey
}
