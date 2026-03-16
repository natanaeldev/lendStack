export const BRAND = {
  name: 'LendStack',
  company: 'LendStack',
  appTitle: 'LendStack',
  tagline: 'Loan Management Platform',
  title: 'LendStack – Loan Management Platform',
  description: 'Plataforma profesional de análisis, amortización y gestión de préstamos.',
  logo: '/lendstack-logo.svg',
  favicon: '/lendstack-favicon.ico',
  socialImage: '/lendstack-logo.svg',
  emailFrom: 'LendStack <onboarding@resend.dev>',
  reminderFrom: 'LendStack <onboarding@resend.dev>',
  documentPrefix: 'LS',
  storagePrefix: 'lendstack-comprobantes',
} as const

export const BRAND_COPY = {
  poweredBy: `${BRAND.name} · ${BRAND.tagline}`,
  receiptFooter: `${BRAND.company} · Comprobante de pago oficial`,
  quoteFooter: `${BRAND.company} · Los cálculos son referenciales y no constituyen asesoramiento financiero oficial.`,
} as const
