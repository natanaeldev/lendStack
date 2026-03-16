import { DefaultSession, DefaultUser } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id:             string
      role:           string
      organizationId: string
      organizationRole?: string | null
      isOrganizationOwner?: boolean
    } & DefaultSession['user']
  }
  interface User extends DefaultUser {
    role?:           string
    organizationId?: string
    organizationRole?: string | null
    isOrganizationOwner?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id?:             string
    role?:           string
    organizationId?: string
    organizationRole?: string | null
    isOrganizationOwner?: boolean
  }
}
