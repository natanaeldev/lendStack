'use client'

import { useMemo, useState } from 'react'
import type { PrestamoClientOption } from './types'

function getClientSearchRank(client: PrestamoClientOption, normalized: string) {
  if (!normalized) return 0

  const name = client.name.toLowerCase()
  const phone = (client.phone ?? '').toLowerCase()
  const email = (client.email ?? '').toLowerCase()
  const branch = (client.branchName ?? '').toLowerCase()

  if (name.startsWith(normalized)) return 0
  if (phone.startsWith(normalized)) return 1
  if (email.startsWith(normalized)) return 2
  if (branch.startsWith(normalized)) return 3
  if (name.includes(normalized)) return 4
  if (phone.includes(normalized)) return 5
  if (email.includes(normalized)) return 6
  if (branch.includes(normalized)) return 7

  return 99
}

export default function ClienteSelectField({
  clients,
  selectedClientId,
  onChange,
}: {
  clients: PrestamoClientOption[]
  selectedClientId: string
  onChange: (clientId: string) => void
}) {
  const [query, setQuery] = useState('')

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  )

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const base = normalized
      ? clients.filter((client) =>
          [client.name, client.email, client.phone, client.branchName]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalized)),
        )
      : clients

    return [...base]
      .sort((left, right) => {
        if (left.id === selectedClientId) return -1
        if (right.id === selectedClientId) return 1

        const rankDiff = getClientSearchRank(left, normalized) - getClientSearchRank(right, normalized)
        if (rankDiff !== 0) return rankDiff

        return left.name.localeCompare(right.name)
      })
      .slice(0, normalized ? 10 : 8)
  }, [clients, query, selectedClientId])

  const quickClients = useMemo(() => clients.slice(0, 5), [clients])
  const hasQuery = query.trim().length > 0

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,.04)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Cliente</label>
            <p className="mt-1 text-sm text-slate-500">Busca por nombre, telefono, email o sucursal.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {hasQuery ? `${filteredClients.length} resultados` : `${filteredClients.length} visibles`}
          </span>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 focus-within:border-blue-500 focus-within:bg-white">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej: Maria, 8095551234 o Santiago"
            autoComplete="off"
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>

        {!hasQuery && quickClients.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Acceso rapido</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickClients.map((client) => {
                const active = client.id === selectedClientId
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => onChange(client.id)}
                    className="rounded-full border px-3 py-2 text-sm font-semibold transition-colors"
                    style={{
                      borderColor: active ? '#1565C0' : '#E2E8F0',
                      background: active ? '#EEF4FF' : '#FFFFFF',
                      color: active ? '#0D2B5E' : '#334155',
                    }}
                  >
                    {client.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {selectedClient && (
        <div className="rounded-[24px] border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-[0_10px_28px_rgba(21,101,192,.08)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Cliente seleccionado</p>
              <p className="mt-1 text-base font-bold text-slate-900">{selectedClient.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {[selectedClient.phone, selectedClient.email].filter(Boolean).join(' · ') || 'Sin contacto adicional'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange('')}
              className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700"
            >
              Cambiar
            </button>
          </div>
          {selectedClient.branchName && (
            <div className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
              {selectedClient.branchName}
            </div>
          )}
        </div>
      )}

      <div className="rounded-[24px] border border-slate-200 bg-white p-2 shadow-[0_10px_30px_rgba(15,23,42,.04)]">
        <div className="mb-2 flex items-center justify-between px-2 pt-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {hasQuery ? 'Mejores coincidencias' : 'Clientes recientes'}
          </p>
          {selectedClient && !hasQuery ? (
            <button type="button" onClick={() => setQuery(selectedClient.name)} className="text-xs font-semibold text-blue-700">
              Buscar seleccionado
            </button>
          ) : null}
        </div>
        <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
          {filteredClients.map((client) => {
            const active = client.id === selectedClientId
            return (
              <button
                key={client.id}
                type="button"
                onClick={() => onChange(client.id)}
                className="w-full rounded-2xl border px-4 py-4 text-left transition-all"
                style={{
                  borderColor: active ? '#1565C0' : '#E2E8F0',
                  background: active ? '#EEF4FF' : '#FFFFFF',
                  boxShadow: active ? '0 0 0 2px rgba(21,101,192,.08)' : 'none',
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 inline-flex h-5 w-5 flex-none rounded-full border-2"
                    style={{
                      borderColor: active ? '#1565C0' : '#CBD5E1',
                      background: active ? 'radial-gradient(circle at center,#1565C0 0 42%, transparent 45%)' : '#FFFFFF',
                    }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-slate-800">{client.name}</p>
                        <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                          {[client.phone, client.email].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                        </p>
                      </div>
                      {active && (
                        <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                          Activo
                        </span>
                      )}
                    </div>
                    {client.branchName && (
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {client.branchName}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
          {filteredClients.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No hay clientes que coincidan con la busqueda.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
