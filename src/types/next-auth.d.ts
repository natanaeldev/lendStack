import { DefaultSession, DefaultUser } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id:             string
      role:           string   // 'master' | 'user'
      organizationId: string   // e.g. 'org_001'
    } & DefaultSession['user']
  }
  interface User extends DefaultUser {
    role?:           string
    organizationId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id?:             string
    role?:           string
    organizationId?: string
  }
}
