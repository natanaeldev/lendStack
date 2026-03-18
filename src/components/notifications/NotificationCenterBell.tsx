'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type NotificationItem = {
  _id: string
  title: string
  message: string
  actionUrl: string | null
  isRead: boolean
  createdAt: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  category: 'loan' | 'payment' | 'document' | 'compliance' | 'review' | 'system'
}

const CATEGORY_ICON: Record<NotificationItem['category'], string> = {
  loan: '💼',
  payment: '💸',
  document: '📄',
  compliance: '🛡️',
  review: '🧾',
  system: '🔔',
}

function timeAgo(value: string) {
  const deltaMs = Date.now() - new Date(value).getTime()
  const minutes = Math.max(1, Math.round(deltaMs / 60000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.round(hours / 24)} d`
}

export default function NotificationCenterBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const visibleCount = useMemo(() => (unreadCount > 99 ? '99+' : String(unreadCount)), [unreadCount])

  async function refreshCount() {
    try {
      const response = await fetch('/api/notifications/count', { cache: 'no-store' })
      const json = await response.json()
      if (!json?.error) setUnreadCount(Number(json.unreadCount ?? 0))
    } catch {}
  }

  async function loadLatest() {
    setLoading(true)
    try {
      const response = await fetch('/api/notifications?page=1&pageSize=6&state=all', { cache: 'no-store' })
      const json = await response.json()
      if (!json?.error) {
        setItems(json.items ?? [])
        setUnreadCount(Number(json.unreadCount ?? 0))
      }
    } finally {
      setLoading(false)
    }
  }

  async function markRead(notificationId: string) {
    await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
    setItems((current) => current.map((item) => (item._id === notificationId ? { ...item, isRead: true } : item)))
    setUnreadCount((current) => Math.max(0, current - 1))
    window.dispatchEvent(new Event('lendstack:notifications-refresh'))
  }

  async function markAllRead() {
    await fetch('/api/notifications/mark-all-read', { method: 'POST' })
    setItems((current) => current.map((item) => ({ ...item, isRead: true })))
    setUnreadCount(0)
    window.dispatchEvent(new Event('lendstack:notifications-refresh'))
  }

  useEffect(() => {
    refreshCount()
    const interval = window.setInterval(refreshCount, 30000)
    const onRefresh = () => refreshCount()
    window.addEventListener('lendstack:notifications-refresh', onRefresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('lendstack:notifications-refresh', onRefresh)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    loadLatest()
  }, [open])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        aria-label="Notificaciones"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="text-base leading-none">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {visibleCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[65] bg-slate-950/40 backdrop-blur-[1px] sm:hidden"
            aria-label="Cerrar notificaciones"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[85vh] flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200 bg-white shadow-2xl slide-up sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:max-h-none sm:w-[min(92vw,24rem)] sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Centro de notificaciones"
          >
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />

            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-4 sm:items-center sm:py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Notificaciones</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={markAllRead} className="min-h-10 rounded-xl px-3 text-xs font-semibold text-blue-600 disabled:text-slate-300" disabled={unreadCount === 0}>
                  Marcar todo
                </button>
                <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 sm:hidden" aria-label="Cerrar panel">
                  ✕
                </button>
              </div>
            </div>

            <div className="max-h-[min(55vh,26rem)] overflow-y-auto sm:max-h-[26rem]">
              {loading ? (
                <div className="px-4 py-6 text-sm text-slate-500">Cargando notificaciones…</div>
              ) : items.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-slate-700">No hay novedades</p>
                  <p className="mt-1 text-xs text-slate-500">Las alertas operativas aparecerán aquí.</p>
                </div>
              ) : (
                items.map((item) => (
                  <a
                    key={item._id}
                    href={item.actionUrl ?? '/app/notificaciones'}
                    onClick={async () => {
                      if (!item.isRead) await markRead(item._id)
                      setOpen(false)
                    }}
                    className={`block border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 ${item.isRead ? 'bg-white' : 'bg-sky-50/50'}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 text-base">{CATEGORY_ICON[item.category]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-slate-900">{item.title}</p>
                          {!item.isRead && <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                        </div>
                        <p className="mt-1 break-words text-xs leading-5 text-slate-600">{item.message}</p>
                        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">{timeAgo(item.createdAt)}</p>
                      </div>
                    </div>
                  </a>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:py-3">
              <a href="/app/notificaciones" className="flex min-h-11 items-center justify-center rounded-xl text-center text-sm font-semibold text-blue-600">
                Ver centro de notificaciones
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
