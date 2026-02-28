import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JVF Inversiones SRL — Calculadora de Préstamos Pro',
  description: 'Herramienta profesional de análisis, amortización y gestión de préstamos con perfiles de riesgo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
