import { OnboardingConflictError } from './selfServiceOnboarding.ts'

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern))
}

export function mapMongoDuplicateKeyToOnboardingConflict(error: any): OnboardingConflictError | null {
  if (error?.code !== 11000) return null

  const keyPattern = error?.keyPattern ?? {}
  const keyValue = error?.keyValue ?? {}
  const namespace = String(error?.ns ?? '')
  const message = String(error?.message ?? '').toLowerCase()

  if (
    keyPattern.email === 1 ||
    'email' in keyValue ||
    includesAny(namespace, ['.users']) ||
    includesAny(message, [' index: email_', ' dup key: { email:'])
  ) {
    // Use a distinct code from `existing_user_requires_login`.
    // An E11000 means the INSERT was rejected — the user was never saved (the
    // transaction rolled back). Redirecting to login would guarantee a 401 because
    // the account does not exist. The frontend must show an in-place error instead.
    return new OnboardingConflictError(
      'Ese email ya está en uso. Intentá con otro email o iniciá sesión si ya tenés cuenta.',
      'email_conflict',
    )
  }

  if (
    keyPattern.slug === 1 ||
    'slug' in keyValue ||
    includesAny(namespace, ['.organizations']) ||
    includesAny(message, [' index: slug_', ' dup key: { slug:'])
  ) {
    return new OnboardingConflictError(
      'Ya existe una organización con ese nombre.',
      'organization_exists',
    )
  }

  if (
    (keyPattern.organizationId === 1 && keyPattern.userId === 1) ||
    ('organizationId' in keyValue && 'userId' in keyValue) ||
    includesAny(namespace, ['.organization_users']) ||
    includesAny(message, [' index: organizationid_1_userid_1'])
  ) {
    return new OnboardingConflictError(
      'Ya perteneces a esa organización.',
      'membership_exists',
    )
  }

  return new OnboardingConflictError(
    'Ya existe un registro con esos datos. Si ya intentaste registrarte antes, inicia sesión para continuar.',
    'conflict',
  )
}
