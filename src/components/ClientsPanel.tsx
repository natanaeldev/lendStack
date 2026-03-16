'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  calculateLoan,
  CURRENCIES,
  type Branch,
  type CarritoFrequency,
  type CarritoLoanResult,
  type Currency,
  formatCurrency,
  formatPercent,
  type LoanParams,
  type LoanResult,
  type LoanType,
  type RateMode,
  type RiskProfile,
  RISK_PROFILES,
  type WeeklyLoanResult,
} from '@/lib/loan'
import ClienteListResponsive from '@/components/clientes/ClienteListResponsive'
import ClienteFilterChips from '@/components/clientes/ClienteFilterChips'
import ClientesHeader from '@/components/clientes/ClientesHeader'
import ClienteSearchBar from '@/components/clientes/ClienteSearchBar'
import EmptyState from '@/components/clientes/EmptyState'
import NewClienteButton from '@/components/clientes/NewClienteButton'
import {
  asLoanParams,
  type BranchDoc,
  type ClientFilterKey,
  type ClientRecord,
  getClientPortfolioStatus,
  matchesClientSearch,
  type LoanStatus,
  type StorageMode,
} from '@/components/clientes/helpers'

interface Props {
  currentParams: LoanParams
  currentResult: LoanResult
  currentLoanType?: LoanType
  weeklyResult?: WeeklyLoanResult
  weeklyTermWeeks?: number
  weeklyMonthlyRate?: number
  carritoResult?: CarritoLoanResult
  carritoFlatRate?: number
  carritoTerm?: number
  carritoPayments?: number
  carritoFreq?: CarritoFrequency
  onLoadClient: (params: LoanParams) => void
  onViewProfile?: (id: string) => void
}

const LOCAL_KEY = 'lendstack_clients'

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  idType: 'DNI',
  idNumber: '',
  birthDate: '',
  nationality: '',
  address: '',
  occupation: '',
  monthlyIncome: '',
  hasIncomeProof: false,
  currentDebts: '',
  totalDebtValue: '',
  paymentCapacity: '',
  collateral: '',
  territorialTies: '',
  creditHistory: '',
  reference1: '',
  reference2: '',
  notes: '',
  loanStartDate: '',
  branchId: '',
}

type FormData = typeof EMPTY_FORM

function SectionHeader({ title, helper }: { title: string; helper?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-6 w-1 rounded-full bg-[linear-gradient(180deg,#1565C0,#0D2B5E)]" />
        <h3 className="font-display text-sm text-slate-900 sm:text-base">{title}</h3>
      </div>
      {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
    </div>
  )
}

function Field({
  label,
  children,
  full,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100'

function cardStyles(borderColor = '#E2E8F0') {
  return {
    borderColor,
    boxShadow: '0 16px 40px rgba(15,23,42,.06)',
  }
}

function getAmortizedPreview(result: LoanResult, params: LoanParams) {
  return [
    { label: 'Monto', value: formatCurrency(params.amount, params.currency) },
    { label: 'Plazo', value: `${params.termYears} años` },
    { label: 'Cuota', value: `${formatCurrency(result.monthlyPayment, params.currency)} / mes` },
    { label: 'Interés', value: formatPercent(result.monthlyRate, 3) },
  ]
}

function LoanSnapshot({
  loanSource,
  currentLoanType,
  currentParams,
  currentResult,
  weeklyResult,
  weeklyTermWeeks,
  carritoResult,
  carritoTerm,
  carritoPayments,
  carritoFreq,
  manualParams,
  manualResult,
}: {
  loanSource: 'calculator' | 'manual'
  currentLoanType: LoanType
  currentParams: LoanParams
  currentResult: LoanResult
  weeklyResult?: WeeklyLoanResult
  weeklyTermWeeks?: number
  carritoResult?: CarritoLoanResult
  carritoTerm?: number
  carritoPayments?: number
  carritoFreq?: CarritoFrequency
  manualParams: LoanParams
  manualResult: LoanResult
}) {
  if (loanSource === 'manual') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4" style={cardStyles()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Origen manual</p>
            <h4 className="mt-1 text-sm font-semibold text-slate-900">Configuración rápida del préstamo</h4>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {manualParams.rateMode === 'monthly' ? 'Tasa mensual' : 'Tasa anual'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {getAmortizedPreview(manualResult, manualParams).map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const previewItems =
    currentLoanType === 'weekly' && weeklyResult
      ? [
          { label: 'Producto', value: 'Semanal' },
          { label: 'Monto', value: formatCurrency(currentParams.amount, currentParams.currency) },
          { label: 'Plazo', value: `${weeklyTermWeeks ?? weeklyResult.totalWeeks} semanas` },
          { label: 'Cuota', value: `${formatCurrency(weeklyResult.weeklyPayment, currentParams.currency)} / semana` },
        ]
      : currentLoanType === 'carrito' && carritoResult
        ? [
            { label: 'Producto', value: 'Carrito' },
            { label: 'Monto', value: formatCurrency(currentParams.amount, currentParams.currency) },
            { label: 'Plazo', value: `${carritoTerm ?? 0} ${carritoFreq === 'daily' ? 'días' : 'semanas'}` },
            { label: 'Cuota', value: `${formatCurrency(carritoResult.fixedPayment, currentParams.currency)} / pago` },
            { label: 'Pagos', value: String(carritoPayments ?? carritoResult.numPayments) },
          ]
        : [
            { label: 'Producto', value: 'Amortizado' },
            ...getAmortizedPreview(currentResult, currentParams),
          ]

  return (
    <div className="rounded-3xl border border-blue-100 bg-[radial-gradient(circle_at_top_left,_rgba(219,234,254,.8),_rgba(255,255,255,1)_60%)] p-4" style={cardStyles('#BFDBFE')}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Usando calculadora</p>
          <h4 className="mt-1 text-sm font-semibold text-slate-900">Se guardará el escenario activo del simulador</h4>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
          {currentLoanType === 'weekly' ? 'Semanal' : currentLoanType === 'carrito' ? 'Carrito' : 'Amortizado'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {previewItems.map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/70 bg-white px-3 py-3 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ClientsPanel({
  currentParams,
  currentResult,
  currentLoanType = 'amortized',
  weeklyResult,
  weeklyTermWeeks,
  weeklyMonthlyRate,
  carritoResult,
  carritoFlatRate,
  carritoTerm,
  carritoPayments,
  carritoFreq,
  onLoadClient,
  onViewProfile,
}: Props) {
  const formRef = useRef<HTMLDivElement | null>(null)
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [branches, setBranches] = useState<BranchDoc[]>([])
  const [mode, setMode] = useState<StorageMode>('loading')
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ClientFilterKey>('all')
  const [branchFilter, setBranchFilter] = useState<Branch | 'all'>('all')
  const [showCreateForm, setShowCreateForm] = useState(true)
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [loanSource, setLoanSource] = useState<'calculator' | 'manual'>('calculator')
  const [manualAmount, setManualAmount] = useState(currentParams.amount)
  const [manualTermYears, setManualTermYears] = useState(currentParams.termYears)
  const [manualProfile, setManualProfile] = useState<RiskProfile>(currentParams.profile)
  const [manualCurrency, setManualCurrency] = useState<Currency>(currentParams.currency)
  const [manualRateMode, setManualRateMode] = useState<RateMode>(currentParams.rateMode ?? 'annual')
  const [manualCustomRate, setManualCustomRate] = useState(currentParams.customMonthlyRate ?? 0.05)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)

  const manualParams: LoanParams = useMemo(
    () => ({
      amount: manualAmount,
      termYears: manualTermYears,
      profile: manualProfile,
      currency: manualCurrency,
      rateMode: manualRateMode,
      customMonthlyRate: manualRateMode === 'monthly' ? manualCustomRate : undefined,
    }),
    [manualAmount, manualTermYears, manualProfile, manualCurrency, manualRateMode, manualCustomRate]
  )

  const manualResult = useMemo(() => calculateLoan(manualParams), [manualParams])

  const activeParams = useMemo(
    () => ({
      ...(loanSource === 'calculator' ? currentParams : manualParams),
      startDate: form.loanStartDate || undefined,
    }),
    [loanSource, currentParams, manualParams, form.loanStartDate]
  )

  const activeResult = loanSource === 'calculator' ? currentResult : manualResult

  useEffect(() => {
    async function init() {
      try {
        const response = await fetch('/api/clients')
        const data = await response.json()
        if (response.ok && data.configured !== false) {
          setClients(data.clients ?? [])
          setMode('cloud')
          try {
            const branchResponse = await fetch('/api/admin/branches')
            if (branchResponse.ok) {
              const branchData = await branchResponse.json()
              setBranches(branchData.branches ?? [])
            }
          } catch {
          }
          setShowCreateForm((data.clients ?? []).length === 0)
          return
        }
      } catch {
      }

      try {
        const raw = localStorage.getItem(LOCAL_KEY)
        const localClients = raw ? (JSON.parse(raw) as ClientRecord[]) : []
        setClients(localClients)
        setShowCreateForm(localClients.length === 0)
      } catch {
        setClients([])
        setShowCreateForm(true)
      }
      setMode('local')
    }

    init()
  }, [])

  useEffect(() => {
    if (mode !== 'local') return
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(clients))
    } catch {
    }
  }, [clients, mode])

  const counts = useMemo(() => {
    return clients.reduce(
      (acc, client) => {
        const status = getClientPortfolioStatus(client)
        acc.total += 1
        if (status === 'active') acc.active += 1
        if (status === 'delinquent') acc.delinquent += 1
        if (status === 'pending-review') acc.pending += 1
        return acc
      },
      { total: 0, active: 0, delinquent: 0, pending: 0 }
    )
  }, [clients])

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearchQuery = matchesClientSearch(client, search)
      const portfolioStatus = getClientPortfolioStatus(client)
      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'active'
            ? portfolioStatus === 'active'
            : filter === 'delinquent'
              ? portfolioStatus === 'delinquent'
              : portfolioStatus === 'no-loan' || portfolioStatus === 'pending-review'
      const matchesBranch = branchFilter === 'all' || client.branch === branchFilter
      return matchesSearchQuery && matchesFilter && matchesBranch
    })
  }, [branchFilter, clients, filter, search])

  const setField = (key: keyof FormData, value: string | boolean) => {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  const handleOpenCreateForm = () => {
    setShowCreateForm(true)
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const resetCreateForm = () => {
    setForm(EMPTY_FORM)
    setShowAdvancedFields(false)
    setLoanSource('calculator')
  }

  const saveClient = async () => {
    if (!form.name.trim() || !form.branchId || saving) return
    setSaving(true)

    const selectedBranch = branches.find((branch) => branch.id === form.branchId) ?? null

    try {
      if (mode === 'cloud') {
        const payload: Record<string, unknown> = {
          ...form,
          params: activeParams,
          result: activeResult,
          loanType: loanSource === 'calculator' ? currentLoanType : 'amortized',
        }

        if (loanSource === 'calculator' && currentLoanType === 'weekly' && weeklyResult && weeklyTermWeeks) {
          payload.weeklyParams = {
            termWeeks: weeklyTermWeeks,
            monthlyRate: weeklyMonthlyRate ?? 0,
          }
          payload.result = weeklyResult
        }

        if (loanSource === 'calculator' && currentLoanType === 'carrito' && carritoResult) {
          payload.carritoParams = {
            flatRate: carritoFlatRate ?? 0,
            term: carritoTerm ?? 4,
            numPayments: carritoPayments ?? carritoResult.numPayments,
            frequency: carritoFreq ?? 'weekly',
          }
          payload.result = carritoResult
        }

        const response = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await response.json()
        if (!response.ok) {
          console.error('[ClientsPanel] save error', data.error)
          return
        }

        const client: ClientRecord = {
          ...form,
          id: data.id,
          savedAt: data.savedAt,
          branch: selectedBranch?.type ?? null,
          branchId: form.branchId || null,
          branchName: selectedBranch?.name ?? null,
          loanStatus: 'pending',
          loanType: loanSource === 'calculator' ? currentLoanType : 'amortized',
          params: activeParams,
          result:
            loanSource === 'calculator' && currentLoanType === 'weekly' && weeklyResult
              ? {
                  ...weeklyResult,
                  monthlyPayment: activeResult.monthlyPayment,
                  totalMonths: activeResult.totalMonths,
                }
              : loanSource === 'calculator' && currentLoanType === 'carrito' && carritoResult
                ? {
                    ...carritoResult,
                    annualRate: 0,
                    monthlyRate: 0,
                    monthlyPayment: activeResult.monthlyPayment,
                    totalMonths: activeResult.totalMonths,
                  }
                : activeResult,
          documents: [],
          payments: [],
        }

        setClients((previous) => [client, ...previous])
      } else {
        const client: ClientRecord = {
          ...form,
          id: String(Date.now()),
          savedAt: new Date().toISOString(),
          branch: selectedBranch?.type ?? null,
          branchId: form.branchId || null,
          branchName: selectedBranch?.name ?? null,
          loanStatus: 'pending',
          loanType: loanSource === 'calculator' ? currentLoanType : 'amortized',
          params: activeParams,
          result: activeResult,
          documents: [],
          payments: [],
        }
        setClients((previous) => [client, ...previous])
      }

      resetCreateForm()
      setSaved(true)
      setShowCreateForm(false)
      window.setTimeout(() => setSaved(false), 2200)
    } finally {
      setSaving(false)
    }
  }

  const removeClient = async (id: string) => {
    if (mode === 'cloud') {
      try {
        await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      } catch {
      }
    }
    setClients((previous) => previous.filter((client) => client.id !== id))
  }

  const updateStatus = async (id: string, next: LoanStatus) => {
    const current = clients.find((client) => client.id === id)?.loanStatus ?? 'pending'
    const target = current === next ? 'pending' : next
    setUpdatingStatusId(id)
    try {
      if (mode === 'cloud') {
        await fetch(`/api/clients/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loanStatus: target }),
        })
      }
      setClients((previous) =>
        previous.map((client) => (client.id === id ? { ...client, loanStatus: target } : client))
      )
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const branchOptions = useMemo(
    () => [
      { value: 'all', label: 'Todas las sucursales' },
      ...(['sede', 'rutas'] as const)
        .filter((type) => branches.some((branch) => branch.type === type))
        .map((type) => ({ value: type, label: type === 'sede' ? 'Solo sede' : 'Solo rutas' })),
    ],
    [branches]
  )

  return (
    <div className="space-y-4 sm:space-y-5">
      <ClientesHeader
        totalClients={counts.total}
        activeClients={counts.active}
        delinquentClients={counts.delinquent}
        pendingClients={counts.pending}
        storageMode={mode}
        onCreate={handleOpenCreateForm}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start">
        <div className="min-w-0 space-y-3">
          <ClienteSearchBar
            value={search}
            onChange={setSearch}
            resultsLabel={
              search.trim()
                ? `${filteredClients.length} resultado${filteredClients.length === 1 ? '' : 's'}`
                : `${clients.length} cliente${clients.length === 1 ? '' : 's'}`
            }
          />
          <ClienteFilterChips value={filter} onChange={setFilter} />
        </div>

        <div className="min-w-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white p-3.5 shadow-[0_16px_40px_rgba(15,23,42,.06)] sm:p-4" style={cardStyles()}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Vista</p>
              <p className="mt-1 break-words text-sm font-semibold text-slate-700">{'Filtr\u00e1 la cartera por origen operativo'}</p>
            </div>
            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">Sucursal</span>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto px-0.5 pb-1 snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-1">
            {branchOptions.map((option) => {
              const active = branchFilter === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setBranchFilter(option.value as Branch | 'all')}
                  className="min-h-11 shrink-0 snap-start whitespace-nowrap rounded-2xl border px-4 py-2 text-left text-sm font-semibold leading-5 transition sm:w-full sm:whitespace-normal"
                  style={{
                    borderColor: active ? '#93C5FD' : '#E2E8F0',
                    background: active ? '#EFF6FF' : '#FFFFFF',
                    color: active ? '#1D4ED8' : '#475569',
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">
              {mode === 'cloud' ? 'Sincronización en la nube activa.' : 'Modo local activo.'}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {mode === 'cloud'
                ? 'Los cambios quedan disponibles para el equipo en tiempo real.'
                : 'Guardá la configuración de MongoDB para sincronizar entre dispositivos.'}
            </p>
          </div>
        </div>
      </div>

      <div
        ref={formRef}
        className="rounded-[28px] border border-slate-200 bg-white p-4 sm:p-6"
        style={cardStyles(showCreateForm ? '#BFDBFE' : '#E2E8F0')}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <SectionHeader
              title="Nuevo cliente"
              helper="Pensado para cargar un caso en la calle sin perder los datos clave del expediente."
            />
            <p className="mt-2 text-sm text-slate-600">
              Completá primero nombre, teléfono, identificación y sucursal. El resto puede ampliarse ahora o después.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateForm((previous) => !previous)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {showCreateForm ? 'Ocultar formulario' : 'Abrir formulario'}
          </button>
        </div>

        {showCreateForm ? (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'calculator', label: 'Usar calculadora' },
                { key: 'manual', label: 'Configurar manualmente' },
              ] as const).map((item) => {
                const active = loanSource === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setLoanSource(item.key)}
                    className="rounded-2xl border px-4 py-3 text-sm font-semibold transition"
                    style={{
                      borderColor: active ? '#1D4ED8' : '#E2E8F0',
                      background: active ? '#0D2B5E' : '#FFFFFF',
                      color: active ? '#FFFFFF' : '#475569',
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            <LoanSnapshot
              loanSource={loanSource}
              currentLoanType={currentLoanType}
              currentParams={currentParams}
              currentResult={currentResult}
              weeklyResult={weeklyResult}
              weeklyTermWeeks={weeklyTermWeeks}
              carritoResult={carritoResult}
              carritoTerm={carritoTerm}
              carritoPayments={carritoPayments}
              carritoFreq={carritoFreq}
              manualParams={manualParams}
              manualResult={manualResult}
            />

            {loanSource === 'manual' ? (
              <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Monto">
                  <input type="number" min={0} step={1000} value={manualAmount} onChange={(event) => setManualAmount(Number(event.target.value) || 0)} className={inputCls} />
                </Field>
                <Field label="Plazo en años">
                  <input type="number" min={1} step={1} value={manualTermYears} onChange={(event) => setManualTermYears(Math.max(1, Number(event.target.value) || 1))} className={inputCls} />
                </Field>
                <Field label="Moneda">
                  <select value={manualCurrency} onChange={(event) => setManualCurrency(event.target.value as Currency)} className={inputCls}>
                    {Object.entries(CURRENCIES).map(([code, config]) => (
                      <option key={code} value={code}>{config.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Perfil de riesgo">
                  <select value={manualProfile} onChange={(event) => setManualProfile(event.target.value as RiskProfile)} className={inputCls}>
                    {RISK_PROFILES.map((profile) => (
                      <option key={profile.label} value={profile.label}>{profile.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Base de tasa">
                  <select value={manualRateMode} onChange={(event) => setManualRateMode(event.target.value as RateMode)} className={inputCls}>
                    <option value="annual">Anual</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </Field>
                {manualRateMode === 'monthly' ? (
                  <Field label="Tasa mensual">
                    <input type="number" min={0} step={0.001} value={manualCustomRate} onChange={(event) => setManualCustomRate(Number(event.target.value) || 0)} className={inputCls} />
                  </Field>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre completo">
                <input type="text" value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="Ej. María Gómez" className={inputCls} />
              </Field>
              <Field label="Teléfono">
                <input type="text" value={form.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="+1 809 555 1234" className={inputCls} />
              </Field>
              <Field label="Correo electrónico">
                <input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} placeholder="cliente@correo.com" className={inputCls} />
              </Field>
              <Field label="Sucursal asignada">
                <select value={form.branchId} onChange={(event) => setField('branchId', event.target.value)} className={inputCls}>
                  <option value="">Seleccioná una sucursal</option>
                  {(['sede', 'rutas'] as const).map((type) => {
                    const items = branches.filter((branch) => branch.type === type)
                    if (!items.length) return null
                    return (
                      <optgroup key={type} label={type === 'sede' ? 'Sede' : 'Rutas'}>
                        {items.map((branch) => (
                          <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              </Field>
              <Field label="Identificación">
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
                  <select value={form.idType} onChange={(event) => setField('idType', event.target.value)} className={inputCls}>
                    {['DNI', 'CUIT', 'CUIL', 'Pasaporte', 'RUT', 'RUC', 'CC', 'NIT', 'Cédula'].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <input type="text" value={form.idNumber} onChange={(event) => setField('idNumber', event.target.value)} placeholder="Número de documento" className={inputCls} />
                </div>
              </Field>
              <Field label="Inicio del préstamo">
                <input type="date" value={form.loanStartDate} onChange={(event) => setField('loanStartDate', event.target.value)} className={inputCls} />
              </Field>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Información adicional</p>
                  <p className="text-xs text-slate-500">Sumá más contexto si necesitás evaluar ingresos, referencias o capacidad de pago en el momento.</p>
                </div>
                <button type="button" onClick={() => setShowAdvancedFields((previous) => !previous)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                  {showAdvancedFields ? 'Ocultar detalles' : 'Agregar más datos'}
                </button>
              </div>

              {showAdvancedFields ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Fecha de nacimiento"><input type="date" value={form.birthDate} onChange={(event) => setField('birthDate', event.target.value)} className={inputCls} /></Field>
                  <Field label="Nacionalidad"><input type="text" value={form.nationality} onChange={(event) => setField('nationality', event.target.value)} placeholder="Ej. Dominicana" className={inputCls} /></Field>
                  <Field label="Dirección" full><input type="text" value={form.address} onChange={(event) => setField('address', event.target.value)} placeholder="Calle, número, ciudad y referencia" className={inputCls} /></Field>
                  <Field label="Ocupación"><input type="text" value={form.occupation} onChange={(event) => setField('occupation', event.target.value)} placeholder="Ej. Vendedora independiente" className={inputCls} /></Field>
                  <Field label="Ingresos mensuales"><input type="text" value={form.monthlyIncome} onChange={(event) => setField('monthlyIncome', event.target.value)} placeholder="Ej. DOP 35,000" className={inputCls} /></Field>
                  <Field label="Comprobantes de ingresos">
                    <div className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4">
                      {[true, false].map((value) => (
                        <label key={String(value)} className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="radio" checked={form.hasIncomeProof === value} onChange={() => setField('hasIncomeProof', value)} className="accent-blue-600" />
                          {value ? 'Sí' : 'No'}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="Capacidad de pago"><input type="text" value={form.paymentCapacity} onChange={(event) => setField('paymentCapacity', event.target.value)} placeholder="Ej. DOP 8,000 por mes" className={inputCls} /></Field>
                  <Field label="Deudas actuales" full><input type="text" value={form.currentDebts} onChange={(event) => setField('currentDebts', event.target.value)} placeholder="Tarjeta, proveedor, informal, etc." className={inputCls} /></Field>
                  <Field label="Valor total de deudas"><input type="text" value={form.totalDebtValue} onChange={(event) => setField('totalDebtValue', event.target.value)} placeholder="Ej. DOP 45,000" className={inputCls} /></Field>
                  <Field label="Garantía o colateral"><input type="text" value={form.collateral} onChange={(event) => setField('collateral', event.target.value)} placeholder="Vehículo, inventario, inmueble, etc." className={inputCls} /></Field>
                  <Field label="Arraigo territorial" full><input type="text" value={form.territorialTies} onChange={(event) => setField('territorialTies', event.target.value)} placeholder="Tiempo de residencia, familia, negocio fijo" className={inputCls} /></Field>
                  <Field label="Historial crediticio" full><input type="text" value={form.creditHistory} onChange={(event) => setField('creditHistory', event.target.value)} placeholder="Ej. Cliente al día / mora resuelta en 2024" className={inputCls} /></Field>
                  <Field label="Referencia 1"><input type="text" value={form.reference1} onChange={(event) => setField('reference1', event.target.value)} placeholder="Nombre y teléfono" className={inputCls} /></Field>
                  <Field label="Referencia 2"><input type="text" value={form.reference2} onChange={(event) => setField('reference2', event.target.value)} placeholder="Nombre y teléfono" className={inputCls} /></Field>
                  <Field label="Notas" full><textarea value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="Observaciones del asesor" className={`${inputCls} min-h-[110px] resize-y`} /></Field>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{saved ? 'Cliente guardado correctamente.' : 'Listo para guardar el expediente.'}</p>
                <p className="text-xs text-slate-500">
                  {form.branchId ? `Sucursal: ${branches.find((branch) => branch.id === form.branchId)?.name ?? 'No disponible'}` : 'Seleccioná una sucursal para continuar.'}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={resetCreateForm} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Limpiar</button>
                <button
                  type="button"
                  onClick={saveClient}
                  disabled={!form.name.trim() || !form.branchId || saving}
                  className="min-h-12 rounded-2xl px-5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)', boxShadow: '0 14px 28px rgba(21,101,192,.25)' }}
                >
                  {saving ? 'Guardando...' : 'Guardar cliente'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {clients.length === 0 ? (
        <EmptyState title="Todavía no hay clientes cargados" description="Creá el primer cliente para comenzar a registrar expedientes y seguimiento en campo." actionLabel="Nuevo cliente" onAction={handleOpenCreateForm} />
      ) : filteredClients.length === 0 ? (
        <EmptyState
          title="No encontramos coincidencias"
          description="Probá con nombre, teléfono o identificación, o limpiá los filtros para volver a la cartera completa."
          actionLabel="Limpiar filtros"
          onAction={() => {
            setSearch('')
            setFilter('all')
            setBranchFilter('all')
          }}
        />
      ) : (
        <ClienteListResponsive
          clients={filteredClients}
          onOpen={(id) => onViewProfile?.(id)}
          onLoadLoan={(client) => onLoadClient(asLoanParams(client))}
          onRemove={removeClient}
          onUpdateStatus={updateStatus}
          updatingStatusId={updatingStatusId}
        />
      )}

      <div className="sm:hidden">
        <NewClienteButton floating label="Nuevo cliente" onClick={handleOpenCreateForm} />
      </div>
    </div>
  )
}
