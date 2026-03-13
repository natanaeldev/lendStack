'use client'

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-[0_16px_40px_rgba(15,23,42,.05)]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl">
        👥
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 min-h-12 rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:opacity-95"
      >
        {actionLabel}
      </button>
    </div>
  )
}
