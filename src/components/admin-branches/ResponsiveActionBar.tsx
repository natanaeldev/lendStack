'use client'

import type { ReactNode } from 'react'

export default function ResponsiveActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">{children}</div>
    </div>
  )
}
