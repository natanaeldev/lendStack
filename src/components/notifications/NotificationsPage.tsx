'use client'

import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/Header'

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

type NotificationPreferences = {
  categories: Record<string, { inApp: boolean }>
}

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Todas',
  loan: 'Préstamos',
  payment: 'Pagos',
  document: 'Documentos',
  compliance: 'Compliance',
  review: 'Revisión',
  system: 'Sistema',
}

const PRIORITY_STYLES: Record<NotificationItem['priority'], string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  critical: 'bg-rose-100 text-rose-700',
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-DO', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function groupNotificationsByRecency(items: NotificationItem[], now = new Date()) {
  const todayKey = now.toISOString().slice(0, 10)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)

  return items.reduce(
    (acc, item) => {
      const key = item.createdAt.slice(0, 10)
      if (key === todayKey) acc.today.push(item)
      else if (key === yesterdayKey) acc.yesterday.push(item)
      else acc.earlier.push(item)
      return acc
    },
    {
      today: [] as NotificationItem[],
      yesterday: [] as NotificationItem[],
      earlier: [] as NotificationItem[],
    },
  )
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [category, setCategory] = useState('all')
  const [state, setState] = useState<'all' | 'read' | 'unread'>('all')
  const [loading, setLoading] = useState(true)
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const grouped = useMemo(() => groupNotificationsByRecency(items), [items])

  async function loadNotifications() {
    setLoading(true)
    try {
      const response = await fetch(`/api/notifications?page=1&pageSize=50&category=${category}&state=${state}`, { cache: 'no-store' })
      const json = await response.json()
      if (!json?.error) {
        setItems(json.items ?? [])
        setUnreadCount(Number(json.unreadCount ?? 0))
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadPreferences() {
    const response = await fetch('/api/notifications/preferences', { cache: 'no-store' })
    const json = await response.json()
    if (!json?.error) setPreferences(json.preferences ?? null)
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
    setItems((current) => current.map((item) => (item._id === id ? { ...item, isRead: true } : item)))
    setUnreadCount((current) => Math.max(0, current - 1))
    window.dispatchEvent(new Event('lendstack:notifications-refresh'))
  }

  async function markAllRead() {
    await fetch('/api/notifications/mark-all-read', { method: 'POST' })
    setItems((current) => current.map((item) => ({ ...item, isRead: true })))
    setUnreadCount(0)
    window.dispatchEvent(new Event('lendstack:notifications-refresh'))
  }

  async function toggleCategoryPreference(key: string, nextValue: boolean) {
    if (!preferences) return
    const next = {
      ...preferences,
      categories: {
        ...preferences.categories,
        [key]: {
          ...preferences.categories[key],
          inApp: nextValue,
        },
      },
    }
    setPreferences(next)
    await fetch('/api/notifications/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: next.categories }),
    })
    window.dispatchEvent(new Event('lendstack:notifications-refresh'))
  }

  useEffect(() => {
    loadNotifications()
  }, [category, state])

  useEffect(() => {
    loadPreferences()
  }, [])

  const sections = [
    { title: 'Hoy', items: grouped.today },
    { title: 'Ayer', items: grouped.yesterday },
    { title: 'Anteriores', items: grouped.earlier },
  ].filter((section) => section.items.length > 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),18rem]">
          <section className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Centro de notificaciones</p>
                  <h1 className="mt-2 text-2xl font-semibold text-slate-950">Alertas operativas del workspace</h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-500">Seguimiento de préstamos, cobranzas, documentos y revisiones manuales. Cada alerta abre el flujo relacionado.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={markAllRead} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:text-slate-300" disabled={unreadCount === 0}>
                    Marcar todo leído
                  </button>
                  <a href="/app" className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
                    Volver al dashboard
                  </a>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <button key={key} onClick={() => setCategory(key)} className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${category === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 sm:ml-auto">
                  {[
                    { key: 'all', label: 'Todas' },
                    { key: 'unread', label: 'Sin leer' },
                    { key: 'read', label: 'Leídas' },
                  ].map((option) => (
                    <button key={option.key} onClick={() => setState(option.key as 'all' | 'read' | 'unread')} className={`min-h-10 rounded-xl border px-3 text-sm font-semibold ${state === option.key ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              {loading ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">Cargando notificaciones…</div>
              ) : sections.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-base font-semibold text-slate-800">No se encontraron alertas</p>
                  <p className="mt-2 text-sm text-slate-500">Ajusta los filtros o espera nuevos eventos operativos.</p>
                </div>
              ) : (
                sections.map((section) => (
                  <div key={section.title} className="border-b border-slate-100 last:border-b-0">
                    <div className="px-5 py-4">
                      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{section.title}</h2>
                    </div>
                    <div className="space-y-0">
                      {section.items.map((item) => (
                        <div key={item._id} className={`px-5 py-4 ${item.isRead ? 'bg-white' : 'bg-sky-50/40'}`}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${PRIORITY_STYLES[item.priority]}`}>{item.priority}</span>
                                {!item.isRead && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Nueva</span>}
                              </div>
                              <p className="mt-2 text-sm text-slate-600">{item.message}</p>
                              <p className="mt-2 text-xs text-slate-400">{formatDate(item.createdAt)}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {item.actionUrl && (
                                <a href={item.actionUrl} className="inline-flex min-h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
                                  Abrir
                                </a>
                              )}
                              {!item.isRead && (
                                <button onClick={() => markRead(item._id)} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">
                                  Marcar leída
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Estado</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{unreadCount}</p>
              <p className="mt-1 text-sm text-slate-500">alertas sin leer en tu cola operativa.</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Preferencias in-app</p>
              <div className="mt-4 space-y-3">
                {preferences ? (
                  Object.entries(preferences.categories).map(([key, value]) => (
                    <label key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-3 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{CATEGORY_LABELS[key] ?? key}</p>
                        <p className="text-xs text-slate-500">Mostrar alertas de esta categoría en el centro.</p>
                      </div>
                      <input type="checkbox" checked={!!value.inApp} onChange={(event) => toggleCategoryPreference(key, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Cargando preferencias…</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
