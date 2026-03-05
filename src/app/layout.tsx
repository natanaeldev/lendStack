import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'LendStack — Plataforma de Gestión de Préstamos',
  description: 'Plataforma profesional de análisis, amortización y gestión de créditos con perfiles de riesgo',
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
