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
  getLoanTypeLabel,
  getPortfolioBadge,
  getRiskProfile,
  phoneHref,
  type ClientRecord,
  type LoanStatus,
} from './helpers'

export default function ClienteCard({
  client,
  onOpen,
  onLoadLoan,
  onRemove,
  onUpdateStatus,
  isBusy,
}: {
  client: ClientRecord
  onOpen: (id: string) => void
  onLoadLoan: (client: ClientRecord) => void
  onRemove: (id: string) => void
  onUpdateStatus: (id: string, next: LoanStatus) => void
  isBusy: boolean
}) {
  const portfolioBadge = getPortfolioBadge(getClientPortfolioStatus(client))
  const applicationBadge = getApplicationBadge(client.loanStatus)
  const branchBadge = client.branch ? BRANCH_STYLES[client.branch] : null
  const risk = getRiskProfile(client.params.profile)
  const callLink = phoneHref(client.phone)

  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_36px_rgba(15,23,42,.06)]">
      <button type="button" onClick={() => onOpen(client.id)} className="w-full p-4 text-left">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0D2B5E,#1565C0)] text-sm font-bold text-white">
            {getInitials(client.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-950">{client.name}</p>
                <p className="mt-1 text-sm text-slate-600">{formatPhone(client.phone)}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Abrir</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <ClienteStatusBadge label={portfolioBadge.label} tone={portfolioBadge.tone as any} />
              <ClienteStatusBadge label={applicationBadge.label} tone={applicationBadge.tone as any} />
              {branchBadge ? <ClienteStatusBadge label={client.branchName ?? branchBadge.label} tone={branchBadge.tone as any} /> : null}
              <ClienteStatusBadge label={risk.label} tone="info" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Préstamo</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{getClientLoanAmount(client)}</p>
                <p className="mt-1 text-xs text-slate-500">{getLoanTypeLabel(client)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Alta</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatShortDate(client.savedAt)}</p>
                <p className="mt-1 text-xs text-slate-500">{client.idNumber ? `${client.idType} ${client.idNumber}` : '—'}</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">{getClientSummary(client)}</p>
          </div>
        </div>
      </button>

      <div className="border-t border-slate-100 px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpen(client.id)}
            className="min-h-11 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Ver
          </button>
          {callLink ? (
            <a
              href={callLink}
              className="flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
            >
              Llamar
            </a>
          ) : (
            <div className="flex min-h-11 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-400">
              No disponible
            </div>
          )}
          <button
            type="button"
            onClick={() => onLoadLoan(client)}
            className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            Usar cálculo
          </button>
          <button
            type="button"
            onClick={() => onRemove(client.id)}
            className="min-h-11 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600"
          >
            Eliminar
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onUpdateStatus(client.id, 'approved')}
            className="min-h-10 rounded-2xl border px-3 text-xs font-bold transition disabled:opacity-50"
            style={{
              borderColor: client.loanStatus === 'approved' ? '#16A34A' : '#BBF7D0',
              background: client.loanStatus === 'approved' ? '#16A34A' : '#F0FDF4',
              color: client.loanStatus === 'approved' ? '#FFFFFF' : '#15803D',
            }}
          >
            Aprobar
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onUpdateStatus(client.id, 'denied')}
            className="min-h-10 rounded-2xl border px-3 text-xs font-bold transition disabled:opacity-50"
            style={{
              borderColor: client.loanStatus === 'denied' ? '#DC2626' : '#FECACA',
              background: client.loanStatus === 'denied' ? '#DC2626' : '#FFF1F2',
              color: client.loanStatus === 'denied' ? '#FFFFFF' : '#DC2626',
            }}
          >
            Denegar
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onUpdateStatus(client.id, 'pending')}
            className="min-h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 transition disabled:opacity-50"
          >
            Pendiente
          </button>
        </div>
      </div>
    </article>
  )
}
