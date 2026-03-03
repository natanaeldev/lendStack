import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware() {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  // Protect everything EXCEPT: auth API, login page, signup page, Next.js internals, and static files
  matcher: [
    '/((?!api/auth|login|signup|_next/static|_next/image|favicon\\.ico|logo\\.png).*)',
  ],
}
