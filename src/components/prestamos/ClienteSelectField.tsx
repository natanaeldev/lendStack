'use client'

import { useMemo, useState } from 'react'
import type { PrestamoClientOption } from './types'

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

    return base.slice(0, 8)
  }, [clients, query])

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Cliente
        </label>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar cliente por nombre, telefono o email..."
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500"
        />
      </div>

      {selectedClient && (
        <div
          className="rounded-2xl border p-3"
          style={{ borderColor: '#BFDBFE', background: '#F8FBFF' }}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Cliente seleccionado</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{selectedClient.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            {[selectedClient.phone, selectedClient.email, selectedClient.branchName].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filteredClients.map((client) => {
          const active = client.id === selectedClientId
          return (
            <button
              key={client.id}
              type="button"
              onClick={() => onChange(client.id)}
              className="w-full rounded-2xl border px-4 py-3 text-left transition-all"
              style={{
                borderColor: active ? '#1565C0' : '#E2E8F0',
                background: active ? '#EEF4FF' : '#FFFFFF',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{client.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[client.phone, client.email, client.branchName].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                  </p>
                </div>
                {active && (
                  <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Activo
                  </span>
                )}
              </div>
            </button>
          )
        })}
        {filteredClients.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">
            No hay clientes que coincidan con la busqueda.
          </div>
        )}
      </div>
    </div>
  )
}

