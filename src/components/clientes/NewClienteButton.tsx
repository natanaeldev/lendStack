'use client'

export default function NewClienteButton({
  label,
  onClick,
  floating = false,
}: {
  label: string
  onClick: () => void
  floating?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        floating
          ? 'fixed bottom-20 left-4 right-4 z-40 min-h-14 rounded-2xl px-5 text-sm font-bold text-white'
          : 'min-h-12 rounded-2xl px-5 text-sm font-bold text-white'
      }
      style={{
        background: 'linear-gradient(135deg,#0D2B5E,#1565C0)',
        boxShadow: '0 18px 34px rgba(21,101,192,.28)',
      }}
    >
      {label}
    </button>
  )
}
