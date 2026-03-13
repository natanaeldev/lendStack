'use client'

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[24px] bg-slate-100 ${className}`.trim()} />
}

export default function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <Block className="h-36" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Block className="h-32" />
        <Block className="h-32" />
        <Block className="h-32" />
        <Block className="h-32" />
        <Block className="h-32" />
        <Block className="h-32" />
      </div>
      <Block className="h-40" />
      <Block className="h-80" />
    </div>
  )
}
