'use client'

import ClienteCard from './ClienteCard'
import ClienteTableDesktop from './ClienteTableDesktop'
import type { ClientRecord, LoanStatus } from './helpers'

export default function ClienteListResponsive({
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
    <>
      <div className="space-y-3 lg:hidden">
        {clients.map((client) => (
          <ClienteCard
            key={client.id}
            client={client}
            onOpen={onOpen}
            onLoadLoan={onLoadLoan}
            onRemove={onRemove}
            onUpdateStatus={onUpdateStatus}
            isBusy={updatingStatusId === client.id}
          />
        ))}
      </div>

      <ClienteTableDesktop
        clients={clients}
        onOpen={onOpen}
        onLoadLoan={onLoadLoan}
        onRemove={onRemove}
        onUpdateStatus={onUpdateStatus}
        updatingStatusId={updatingStatusId}
      />
    </>
  )
}
