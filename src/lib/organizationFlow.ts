export function getOrganizationCreationEndpoint(isAuthenticated: boolean) {
  return isAuthenticated ? '/api/organizations' : '/api/register'
}
