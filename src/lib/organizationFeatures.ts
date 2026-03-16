const TEST_FULL_ACCESS_ORG_SLUGS = new Set(['testorganizacion'])

export const ALL_ORGANIZATION_FEATURES = [
  'reports',
  'branches',
  'billing',
  'admin',
  'users',
  'settings',
] as const

export type OrganizationFeatureKey = (typeof ALL_ORGANIZATION_FEATURES)[number]

export interface OrganizationFeatureOverride {
  fullAccess: boolean
  enabledFeatures: OrganizationFeatureKey[]
}

function normalizeFeatureKey(value: unknown): OrganizationFeatureKey | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  return ALL_ORGANIZATION_FEATURES.find((feature) => feature === normalized) ?? null
}

function normalizeOrganizationSlug(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

export function deriveOrganizationFeatureOverride(organization?: {
  slug?: string | null
  name?: string | null
  featureOverrides?: {
    fullAccess?: boolean | null
    enabledFeatures?: unknown
  } | null
}) : OrganizationFeatureOverride {
  const enabledFeatures = new Set<OrganizationFeatureKey>()
  const configured = Array.isArray(organization?.featureOverrides?.enabledFeatures)
    ? organization?.featureOverrides?.enabledFeatures ?? []
    : []

  for (const item of configured) {
    const feature = normalizeFeatureKey(item)
    if (feature) enabledFeatures.add(feature)
  }

  const slug = normalizeOrganizationSlug(organization?.slug ?? organization?.name)
  const fullAccess =
    organization?.featureOverrides?.fullAccess === true ||
    TEST_FULL_ACCESS_ORG_SLUGS.has(slug)

  if (fullAccess) {
    for (const feature of ALL_ORGANIZATION_FEATURES) {
      enabledFeatures.add(feature)
    }
  }

  return {
    fullAccess,
    enabledFeatures: Array.from(enabledFeatures),
  }
}

export function hasOrganizationFeatureAccess(
  featureOverride: OrganizationFeatureOverride | null | undefined,
  feature: OrganizationFeatureKey,
) {
  if (!featureOverride) return false
  if (featureOverride.fullAccess) return true
  return featureOverride.enabledFeatures.includes(feature)
}
