export interface OrganizationPermissionIdentity {
  role?: string | null
  organizationRole?: string | null
  isOrganizationOwner?: boolean | null
}

export function normalizeOrganizationRole(role?: string | null) {
  return String(role ?? '').trim().toUpperCase()
}

export function isOrganizationOwner(identity?: OrganizationPermissionIdentity | null) {
  if (!identity) return false
  if (identity.isOrganizationOwner) return true
  if (identity.role === 'master') return true
  return normalizeOrganizationRole(identity.organizationRole) === 'OWNER'
}

export function canAccessOrganizationAdmin(identity?: OrganizationPermissionIdentity | null) {
  return isOrganizationOwner(identity)
}

export function canManageOrganizationBillingAccess(identity?: OrganizationPermissionIdentity | null) {
  return isOrganizationOwner(identity)
}

export function hasOrganizationScopedAccess(identity?: OrganizationPermissionIdentity | null) {
  return Boolean(identity?.role || identity?.organizationRole || identity?.isOrganizationOwner)
}
