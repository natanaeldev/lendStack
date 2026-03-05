import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { ObjectId } from 'mongodb'
import { getDb, isDbConfigured } from './mongodb'
import bcrypt from 'bcryptjs'

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
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages:   { signIn: '/login' },
  secret:  process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id             = user.id
        token.email          = user.email
        token.role           = (user as any).role           ?? 'user'
        token.organizationId = (user as any).organizationId ?? 'org_001'
      }
      // Back-fill role/organizationId for tokens issued before these fields were added
      if ((!token.role || !token.organizationId) && token.id && isDbConfigured()) {
        try {
          const db     = await getDb()
          const oid    = new ObjectId(token.id as string)
          const dbUser = await db.collection('users').findOne({ _id: oid })
          if (dbUser) {
            token.role           = dbUser.role           ?? 'user'
            token.organizationId = dbUser.organizationId ?? 'org_001'
          }
        } catch { /* silently skip if id is not a valid ObjectId */ }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id             = token.id             as string
        session.user.role           = token.role           as string
        session.user.email          = token.email          as string
        session.user.organizationId = (token.organizationId as string) ?? 'org_001'
      }
      return session
    },
  },
}
