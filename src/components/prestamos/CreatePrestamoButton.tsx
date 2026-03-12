'use client'

export default function CreatePrestamoButton({
  onClick,
}: {
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 sm:px-5 text-sm font-bold text-white transition-all hover:opacity-95 active:scale-[0.99]"
      style={{
        background: 'linear-gradient(135deg,#0D2B5E,#1565C0)',
        boxShadow: '0 10px 28px rgba(21,101,192,.28)',
      }}
    >
      <span className="text-base leading-none">+</span>
      <span>Crear prestamo</span>
    </button>
  )
}

