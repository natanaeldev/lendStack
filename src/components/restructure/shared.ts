// ─── Restructure UI — Shared constants & helpers ──────────────────────────────

export type ModificationStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'BOOKED' | 'REJECTED' | 'CANCELLED'

export type ModificationType =
  | 'DUE_DATE_CHANGE' | 'TERM_EXTENSION' | 'GRACE_PERIOD'
  | 'CAPITALIZE_ARREARS' | 'RATE_REDUCTION' | 'INTEREST_ONLY_PERIOD' | 'FULL_RESTRUCTURE'

// ─── Status display config ────────────────────────────────────────────────────
export const MOD_STATUS_CFG: Record<ModificationStatus, {
  label: string; color: string; bg: string; border: string; dot: string
}> = {
  DRAFT:            { label: 'Borrador',                color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  PENDING_APPROVAL: { label: 'Pendiente de aprobación', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6' },
  APPROVED:         { label: 'Aprobado',                color: '#14532D', bg: '#F0FDF4', border: '#86EFAC', dot: '#16A34A' },
  BOOKED:           { label: 'Aplicado',                color: '#1E3A5F', bg: '#EFF6FF', border: '#93C5FD', dot: '#2563EB' },
  REJECTED:         { label: 'Rechazado',               color: '#881337', bg: '#FFF1F2', border: '#FECDD3', dot: '#DC2626' },
  CANCELLED:        { label: 'Cancelado',               color: '#374151', bg: '#F9FAFB', border: '#E5E7EB', dot: '#6B7280' },
}

// ─── Type display config ──────────────────────────────────────────────────────
export const MOD_TYPE_CFG: Record<ModificationType, { label: string; emoji: string; desc: string }> = {
  DUE_DATE_CHANGE:      { emoji: '📅', label: 'Cambio de fecha',          desc: 'Mover la fecha de vencimiento de una o varias cuotas' },
  TERM_EXTENSION:       { emoji: '📆', label: 'Extensión de plazo',        desc: 'Agregar cuotas adicionales al final del cronograma' },
  GRACE_PERIOD:         { emoji: '⏸️',  label: 'Período de gracia',         desc: 'Suspender pagos por N períodos, con o sin capitalización de interés' },
  CAPITALIZE_ARREARS:   { emoji: '💼', label: 'Capitalización de mora',    desc: 'Incorporar la mora al capital y regenerar el cronograma' },
  RATE_REDUCTION:       { emoji: '📉', label: 'Reducción de tasa',         desc: 'Reducir la tasa de interés para las cuotas restantes' },
  INTEREST_ONLY_PERIOD: { emoji: '💡', label: 'Solo interés',              desc: 'Convertir los próximos N períodos en cuotas de solo interés' },
  FULL_RESTRUCTURE:     { emoji: '🔄', label: 'Reestructuración total',    desc: 'Reemplazar el cronograma completo con nuevas condiciones' },
}

// ─── Audit action labels ──────────────────────────────────────────────────────
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  DRAFT_CREATED:    'Borrador creado',
  SUBMITTED:        'Enviado para aprobación',
  APPROVED:         'Aprobado',
  REJECTED:         'Rechazado',
  BOOKED:           'Aplicado al préstamo',
  CANCELLED:        'Cancelado',
  CONSENT_RECORDED: 'Consentimiento registrado',
}

// ─── Interfaces mirroring backend types ──────────────────────────────────────
export interface ScheduleSummary {
  remainingInstallments: number
  remainingPrincipal: number
  totalRemainingInterest: number
  totalRemainingPayable: number
  periodicPayment: number
  firstDueDate: string | null
  lastDueDate: string | null
}

export interface InstallmentSnapshot {
  installmentNumber: number
  dueDate: string
  scheduledPrincipal: number
  scheduledInterest: number
  scheduledAmount: number
  status?: string
  paidAmount?: number
}

export interface InstallmentChange {
  action: 'KEEP' | 'SUPERSEDE' | 'ADD' | 'SHIFT_DATE'
  installmentNumber: number
  before: InstallmentSnapshot | null
  after: InstallmentSnapshot | null
}

export interface LoanImpact {
  deltaInstallments: number
  deltaTotalPayable: number
  deltaTotalInterest: number
  deltaPeriodicPayment: number
  deltaRemainingPrincipal: number
  newFirstDueDate: string | null
  newLastDueDate: string | null
}

export interface SimulationResult {
  type: ModificationType
  before: ScheduleSummary
  after: ScheduleSummary
  changes: InstallmentChange[]
  impact: LoanImpact
  newSchedule: InstallmentSnapshot[]
  newRateDecimal?: number
  newPrincipal?: number
  simulatedAt: string
}

export interface EligibilityViolation { code: string; message: string }
export interface EligibilityCheckResult {
  eligible: boolean
  violations: EligibilityViolation[]
  checkedAt: string
}

export interface ModificationAuditEntry {
  _id: string
  action: string
  fromStatus: ModificationStatus | null
  toStatus: ModificationStatus
  actorName: string
  actorRole: string
  reason?: string
  notes?: string
  timestamp: string
}

export interface LoanModification {
  _id: string
  loanId: string
  clientId: string
  type: ModificationType
  status: ModificationStatus
  sequenceNumber: number
  targetVersionNumber: number
  input: Record<string, unknown>
  submissionReason: string
  simulation: SimulationResult
  eligibilitySnapshot: EligibilityCheckResult
  createdBy: string
  createdAt: string
  submittedBy?: string
  submittedAt?: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNotes?: string
  bookedBy?: string
  bookedAt?: string
  cancelledBy?: string
  cancelledAt?: string
  updatedAt: string
}

export interface ScheduleVersion {
  _id: string
  versionNumber: number
  source: 'ORIGINAL' | 'MODIFICATION'
  modificationId: string | null
  modificationId_sequence?: number | null
  remainingPrincipal: number
  totalScheduledInterest: number
  totalScheduledPayable: number
  installmentCount: number
  periodicPayment: number
  installments: InstallmentSnapshot[]
  createdAt: string
}

// ─── Utility helpers ──────────────────────────────────────────────────────────
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

export function fmt(n: number, currency = 'USD'): string {
  try {
    const sym: Record<string, string> = { USD: '$', ARS: '$', EUR: '€', DOP: 'RD$' }
    return `${sym[currency] ?? '$'} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  } catch { return String(n) }
}

export function deltaLabel(n: number, currency?: string): string {
  const sign = n > 0 ? '+' : ''
  return currency ? `${sign}${fmt(n, currency)}` : `${sign}${n}`
}

export const inputCls =
  'w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white'

export const ACTIVE_STATUSES: ModificationStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED']
export const TERMINAL_STATUSES: ModificationStatus[] = ['BOOKED', 'REJECTED', 'CANCELLED']
