import { BRAND } from '@/config/branding'

interface Props {
  variant?: 'light' | 'dark'
  size?: number
  showText?: boolean
}

export default function LendStackLogo({ variant = 'light', size = 40, showText = true }: Props) {
  const isLight = variant === 'light'
  const g1 = isLight ? '#64b5f6' : '#0D2B5E'
  const g2 = isLight ? '#1976D2' : '#1565C0'
  const bar1 = isLight ? 'rgba(255,255,255,.75)' : '#1976D2'
  const bar2 = isLight ? 'rgba(255,255,255,.92)' : '#42a5f5'
  const textPrimary = isLight ? '#ffffff' : '#0D2B5E'
  const textSub = isLight ? 'rgba(255,255,255,.55)' : '#1565C0'
  const gradId = `ls-grad-${variant}`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.28, lineHeight: 1 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
        aria-label={BRAND.name}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="48" x2="48" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={g2} />
            <stop offset="100%" stopColor={g1} />
          </linearGradient>
        </defs>

        <rect x="5" y="4" width="13" height="40" rx="3.5" fill={`url(#${gradId})`} />
        <rect x="5" y="31" width="38" height="13" rx="3.5" fill={`url(#${gradId})`} />
        <rect x="22" y="23" width="9" height="8" rx="2.5" fill={bar1} />
        <rect x="34" y="13" width="9" height="18" rx="2.5" fill={bar2} />
      </svg>

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span
            style={{
              color: textPrimary,
              fontSize: size * 0.62,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              fontFamily: "'DM Sans', system-ui, sans-serif",
              lineHeight: 1,
            }}
          >
            {BRAND.name}
          </span>
          <span
            style={{
              color: textSub,
              fontSize: size * 0.22,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            {BRAND.tagline}
          </span>
        </div>
      )}
    </div>
  )
}
