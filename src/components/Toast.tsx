'use client'
import { useEffect, useState } from 'react'

interface ToastMessage { id: number; icon: string; text: string }

let addToastFn: ((icon: string, text: string) => void) | null = null

export function showToast(icon: string, text: string) {
  addToastFn?.(icon, text)
}

export default function ToastProvider() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    addToastFn = (icon, text) => {
      const id = Date.now()
      setToasts(prev => [...prev, { id, icon, text }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2800)
    }
    return () => { addToastFn = null }
  }, [])

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 items-end">
      {toasts.map(t => (
        <div key={t.id} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-2xl toast-in"
          style={{ background: '#0D2B5E', border: '1px solid #1565C0', maxWidth: 280 }}>
          <span>{t.icon}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
