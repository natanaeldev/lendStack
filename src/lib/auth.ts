import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { ObjectId } from 'mongodb'
import { getDb, isDbConfigured } from './mongodb'
import bcrypt from 'bcryptjs'
import { isOrganizationOwner as resolveOwnerFlag } from './organizationAccess'

async function loadOrganizationIdentity(db: Awaited<ReturnType<typeof getDb>>, dbUser: any) {
  const organizationId = dbUser.organizationId ?? 'org_001'
  const organization = await db.collection('organizations').findOne(
    { _id: organizationId as any },
    { projection: { ownerUserId: 1 } },
  )
  const membership = await db.collection('organization_users').findOne(
    { organizationId, userId: dbUser._id },
    { projection: { role: 1 } },
  )

  const organizationRole = (membership?.role as string | undefined) ?? null
  const isOrganizationOwner = resolveOwnerFlag({
    role: dbUser.role,
    organizationRole,
    isOrganizationOwner:
      organization?.ownerUserId != null && String(organization.ownerUserId) === String(dbUser._id),
  })

  return {
    organizationId,
    organizationRole,
    isOrganizationOwner,
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',      type: 'email'    },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        if (!isDbConfigured()) return null

        const db   = await getDb()
        const user = await db.collection('users').findOne({
          email: credentials.email.trim().toLowerCase(),
        })
        if (!user) return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return {
          id:             String(user._id),
          email:          user.email,
          name:           user.name           ?? 'Usuario',
          role:           user.role           ?? 'user',
          organizationId: user.organizationId ?? 'org_001',
          organizationRole: null,
          isOrganizationOwner: false,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages:   { signIn: '/login' },
  secret:  process.env.NEXTAUTH_SECRET ?? 'dev-only-fallback-secret-not-for-production',
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id             = user.id
        token.email          = user.email
        token.role           = (user as any).role           ?? 'user'
        token.organizationId = (user as any).organizationId ?? 'org_001'
        token.organizationRole = (user as any).organizationRole ?? null
        token.isOrganizationOwner = Boolean((user as any).isOrganizationOwner)
      }
      // Re-sync role and organization on every JWT refresh so nav and authorization
      // do not drift after admin updates or onboarding changes.
      if (token.id && isDbConfigured()) {
        try {
          const db     = await getDb()
          let dbUser = null
          try {
            const oid = new ObjectId(token.id as string)
            dbUser = await db.collection('users').findOne({ _id: oid })
          } catch {
            dbUser = await db.collection('users').findOne({ _id: token.id as any })
          }
          if (dbUser) {
            const identity = await loadOrganizationIdentity(db, dbUser)
            token.role           = identity.isOrganizationOwner ? 'master' : (dbUser.role ?? 'user')
            token.organizationId = identity.organizationId
            token.organizationRole = identity.organizationRole
            token.isOrganizationOwner = identity.isOrganizationOwner
          }
        } catch { /* silently skip when session refresh cannot reach the user document */ }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id             = token.id             as string
        session.user.role           = token.role           as string
        session.user.email          = token.email          as string
        session.user.organizationId = (token.organizationId as string) ?? 'org_001'
        session.user.organizationRole = (token.organizationRole as string | null | undefined) ?? null
        session.user.isOrganizationOwner = Boolean(token.isOrganizationOwner)
      }
      return session
    },
  },
}
