'use client'

import ClienteStatusBadge from './ClienteStatusBadge'
import {
  BRANCH_STYLES,
  formatPhone,
  formatShortDate,
  getApplicationBadge,
  getClientLoanAmount,
  getClientPortfolioStatus,
  getClientSummary,
  getInitials,
  getPortfolioBadge,
  getRiskProfile,
  phoneHref,
  type ClientRecord,
  type LoanStatus,
} from './helpers'

export default function ClienteTableDesktop({
  clients,
  onOpen,
  onLoadLoan,
  onRemove,
  onUpdateStatus,
  updatingStatusId,
}: {
  clients: ClientRecord[]
  onOpen: (id: string) => void
  onLoadLoan: (client: ClientRecord) => void
  onRemove: (id: string) => void
  onUpdateStatus: (id: string, next: LoanStatus) => void
  updatingStatusId: string | null
}) {
  return (
    <div className="hidden overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_36px_rgba(15,23,42,.06)] lg:block">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr className="text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            <th className="px-5 py-4">Cliente</th>
            <th className="px-5 py-4">Teléfono</th>
            <th className="px-5 py-4">Estado</th>
            <th className="px-5 py-4">Resumen</th>
            <th className="px-5 py-4">Sucursal</th>
            <th className="px-5 py-4">Alta</th>
            <th className="px-5 py-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {clients.map((client) => {
            const portfolioBadge = getPortfolioBadge(getClientPortfolioStatus(client))
            const applicationBadge = getApplicationBadge(client.loanStatus)
            const branchBadge = client.branch ? BRANCH_STYLES[client.branch] : null
            const risk = getRiskProfile(client.params.profile)
            const callLink = phoneHref(client.phone)
            const isBusy = updatingStatusId === client.id

            return (
              <tr key={client.id} className="align-top">
                <td className="px-5 py-4">
                  <button type="button" onClick={() => onOpen(client.id)} className="flex items-start gap-3 text-left">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0D2B5E,#1565C0)] text-sm font-bold text-white">
                      {getInitials(client.name)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{client.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{client.idNumber ? `${client.idType} ${client.idNumber}` : '—'}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-700">{getClientLoanAmount(client)}</p>
                    </div>
                  </button>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">{formatPhone(client.phone)}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <ClienteStatusBadge label={portfolioBadge.label} tone={portfolioBadge.tone as any} />
                    <ClienteStatusBadge label={applicationBadge.label} tone={applicationBadge.tone as any} />
                    <ClienteStatusBadge label={risk.label} tone="info" />
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">{getClientSummary(client)}</td>
                <td className="px-5 py-4">
                  {branchBadge ? (
                    <ClienteStatusBadge label={client.branchName ?? branchBadge.label} tone={branchBadge.tone as any} />
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">{formatShortDate(client.savedAt)}</td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(client.id)}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Ver
                    </button>
                    {callLink ? (
                      <a
                        href={callLink}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        Llamar
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onLoadLoan(client)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      Cargar
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onUpdateStatus(client.id, 'approved')}
                      className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 disabled:opacity-50"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onUpdateStatus(client.id, 'denied')}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
                    >
                      Denegar
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(client.id)}
                      className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
