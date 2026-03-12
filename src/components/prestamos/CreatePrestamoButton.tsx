'use client'

import PrimaryActionButton from '@/components/app-shell/PrimaryActionButton'

export default function CreatePrestamoButton({
  onClick,
}: {
  onClick: () => void
}) {
  return <PrimaryActionButton label="Crear préstamo" onClick={onClick} />
}
