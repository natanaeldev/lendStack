import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'
import { BRAND } from '@/config/branding'

const metadataBase = new URL(process.env.APP_URL || process.env.NEXTAUTH_URL || 'https://lendstack.app')

export const metadata: Metadata = {
  metadataBase,
  title: BRAND.title,
  description: BRAND.description,
  applicationName: BRAND.appTitle,
  icons: {
    icon: BRAND.favicon,
    shortcut: BRAND.favicon,
    apple: BRAND.favicon,
  },
  openGraph: {
    title: BRAND.title,
    description: BRAND.description,
    siteName: BRAND.company,
    images: [{ url: BRAND.socialImage, alt: BRAND.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND.title,
    description: BRAND.description,
    images: [BRAND.socialImage],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
