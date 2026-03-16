'use client'

import type { SVGProps } from 'react'

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />
  )
}

export function PortfolioIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 7.5h18" />
      <path d="M6 4.5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
      <path d="M15.5 12h.01" />
      <path d="M14 12h4" />
    </IconBase>
  )
}

export function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
      <path d="M10.3 3.8 3.7 15.2A2 2 0 0 0 5.4 18h13.2a2 2 0 0 0 1.7-2.8L13.7 3.8a2 2 0 0 0-3.4 0Z" />
    </IconBase>
  )
}

export function CollectionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3v18" />
      <path d="M16.5 7.5A4.5 4.5 0 0 0 12 5a4 4 0 0 0 0 8 4 4 0 0 1 0 8 4.5 4.5 0 0 1-4.5-2.5" />
    </IconBase>
  )
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M8 3v3" />
      <path d="M16 3v3" />
      <path d="M4 9.5h16" />
      <rect x="4" y="5" width="16" height="15" rx="2" />
    </IconBase>
  )
}

export function LoanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 19h16" />
      <path d="M6 19V9.5L12 5l6 4.5V19" />
      <path d="M9.5 13h5" />
      <path d="M12 10.5v5" />
    </IconBase>
  )
}

export function TrendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 17 10 11l4 4 6-7" />
      <path d="M20 8v-4h-4" />
    </IconBase>
  )
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </IconBase>
  )
}

export function UserPlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M16 19a4.5 4.5 0 0 0-8 0" />
      <circle cx="12" cy="8" r="3.5" />
      <path d="M19 8v4" />
      <path d="M17 10h4" />
    </IconBase>
  )
}

export function PaymentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M7.5 14h3.5" />
    </IconBase>
  )
}

export function EmptyDashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 18h16" />
      <path d="M6.5 15V9" />
      <path d="M11.5 15V5" />
      <path d="M16.5 15v-3.5" />
    </IconBase>
  )
}
