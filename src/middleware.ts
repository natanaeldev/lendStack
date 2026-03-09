import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Paths that are publicly accessible without a session
const PUBLIC_PATHS = new Set(['/', '/register'])

export default withAuth(
  function middleware() {
    return NextResponse.next()
  },
  {
    secret: process.env.NEXTAUTH_SECRET ?? 'dev-only-fallback-secret-not-for-production',
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        if (PUBLIC_PATHS.has(pathname)) return true
        return !!token
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  // Protect everything EXCEPT: auth API, cron, register API, Stripe webhooks,
  //   login/signup/register pages, Next.js internals, and static files
  matcher: [
    '/((?!api/auth|api/cron|api/register|api/webhooks|login|signup|register|_next/static|_next/image|favicon\\.ico|logo\\.png).*)',
  ],
}
