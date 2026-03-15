'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Header from '@/components/Header'
import Dashboard from '@/components/Dashboard'
import ClientsPanel from '@/components/ClientsPanel'
import ClientProfilePanel from '@/components/ClientProfilePanel'
import LoansPanel from '@/components/LoansPanel'
import LoanDetailPanel from '@/components/LoanDetailPanel'
import BranchesPanel from '@/components/BranchesPanel'
import OrganizationReport from '@/components/OrganizationReport'
import PaymentsHub from '@/components/PaymentsHub'
import QuickPaymentModal from '@/components/QuickPaymentModal'
import EmailModal from '@/components/EmailModal'
import ToastProvider, { showToast } from '@/components/Toast'
import MobileBottomNav from '@/components/app-shell/MobileBottomNav'
import MoreScreen from '@/components/app-shell/MoreScreen'
import LoanCalculatorPage from '@/components/calculator/LoanCalculatorPage'
import { isPremiumTab } from '@/lib/premiumAccess'
import {
  calculateCarritoLoan,
  calculateLoan,
  calculateWeeklyLoan,
  getRiskConfig,
  type CarritoFrequency,
  type Currency,
  type LoanParams,
  type LoanType,
  type RateMode,
  type RiskProfile,
} from '@/lib/loan'

export type Tab = 'calculator' | 'dashboard' | 'clients' | 'loans' | 'branches' | 'reports' | 'payments' | 'more' | 'admin'

const DESKTOP_TABS: { id: Tab; label: string; icon: string; mobileLabel: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠', mobileLabel: 'Inicio' },
  { id: 'loans', label: 'Préstamos', icon: '📋', mobileLabel: 'Préstamos' },
  { id: 'clients', label: 'Clientes', icon: '👥', mobileLabel: 'Clientes' },
  { id: 'payments', label: 'Pagos', icon: '💵', mobileLabel: 'Pagos' },
  { id: 'branches', label: 'Sucursales', icon: '🏢', mobileLabel: 'Sucursales' },
  { id: 'reports', label: 'Reportes', icon: '📑', mobileLabel: 'Reportes' },
  { id: 'admin', label: 'Admin', icon: '⚙️', mobileLabel: 'Admin' },
  { id: 'calculator', label: 'Calculadora', icon: '🧮', mobileLabel: 'Calcular' },
]

const MOBILE_TABS: { id: Tab; label: string; mobileLabel: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Inicio', icon: '🏠' },
  { id: 'loans', label: 'Préstamos', mobileLabel: 'Préstamos', icon: '📋' },
  { id: 'clients', label: 'Clientes', mobileLabel: 'Clientes', icon: '👥' },
  { id: 'payments', label: 'Pagos', mobileLabel: 'Pagos', icon: '💵' },
  { id: 'more', label: 'Más', mobileLabel: 'Más', icon: '☰' },
]

const TAB_META: Record<Tab, { title: string; description: string }> = {
  dashboard: { title: 'Dashboard', description: 'Visión general de cartera y rendimiento diario.' },
  loans: { title: 'Préstamos', description: 'Gestioná originación, estado y cobranza de préstamos.' },
  clients: { title: 'Clientes', description: 'Perfiles, documentos y seguimiento de prestatarios.' },
  payments: { title: 'Pagos', description: 'Registro rápido de cobros y seguimiento de cobranza.' },
  branches: { title: 'Sucursales', description: 'Control operativo por oficina y equipos.' },
  reports: { title: 'Reportes', description: 'KPIs exportables y análisis financiero ejecutivo.' },
  calculator: { title: 'Calculadora', description: 'Simulación y comparación avanzada de escenarios.' },
  more: { title: 'Más', description: 'Acciones secundarias, configuración y soporte.' },
  admin: { title: 'Administración', description: 'Configuración de usuarios, sucursales y permisos.' },
}

export function HomeWithTab({ initialTab = 'dashboard' }: { initialTab?: Tab }) {
  const { data: session } = useSession()
  const isMaster = session?.user?.role === 'master'
  const [dashboardSearch, setDashboardSearch] = useState('')
  const [orgAccess, setOrgAccess] = useState<{ allowPremiumFeatures: boolean } | null>(null)

  const [tab, setTab] = useState<Tab>(initialTab)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null)
  const [loanCreateRequestKey, setLoanCreateRequestKey] = useState(0)
  const [showPayment, setShowPayment] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)

  const [amount, setAmount] = useState(100000)
  const [termUnit, setTermUnit] = useState<'years' | 'months'>('years')
  const [termValue, setTermValue] = useState(5)
  const [profile, setProfile] = useState<RiskProfile>('Medium Risk')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [rateMode, setRateMode] = useState<RateMode>('annual')
  const [customMonthlyRate, setCustomMonthlyRate] = useState(0.015)
  const [loanType, setLoanType] = useState<LoanType>('amortized')
  const [weeklyTermWeeks, setWeeklyTermWeeks] = useState(52)
  const [weeklyMonthlyRate, setWeeklyMonthlyRate] = useState(0.05)
  const [carritoFlatRate, setCarritoFlatRate] = useState(0.2)
  const [carritoTerm, setCarritoTerm] = useState(4)
  const [carritoPayments, setCarritoPayments] = useState(4)
  const [carritoFreq, setCarritoFreq] = useState<CarritoFrequency>('weekly')
  const canUsePremiumFeatures = orgAccess?.allowPremiumFeatures ?? false
  const goToBillingUpgrade = useCallback(() => {
    window.location.href = '/app/billing?required=premium'
  }, [])

  const changeTab = useCallback((newTab: Tab) => {
    if (isPremiumTab(newTab) && orgAccess && !orgAccess.allowPremiumFeatures) {
      goToBillingUpgrade()
      return
    }
    setTab(newTab)
    if (typeof window !== 'undefined') {
      const paths: Record<Tab, string> = {
        dashboard: '/app',
        calculator: '/app/calculadora',
        clients: '/app/clientes',
        loans: '/app/prestamos',
        payments: '/app/pagos',
        branches: '/app/sucursales',
        reports: '/app/reportes',
        more: '/app/mas',
        admin: '/app/admin',
      }
      window.history.pushState(null, '', paths[newTab])
    }
  }, [goToBillingUpgrade, orgAccess])

  useEffect(() => {
    if (!session?.user?.organizationId) return
    fetch('/api/org')
      .then((response) => response.json())
      .then((json) => {
        if (!json?.error) {
          setOrgAccess({
            allowPremiumFeatures: !!json.allowPremiumFeatures,
          })
        }
      })
      .catch(() => null)
  }, [session?.user?.organizationId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const clientId = params.get('clientId')
    const loanId = params.get('loanId')
    if (clientId) {
      setSelectedClientId(clientId)
      setTab('clients')
    }
    if (loanId) {
      setSelectedLoanId(loanId)
      setTab('loans')
    }

    const onPopState = () => {
      const path = window.location.pathname
      if (path.startsWith('/app/calculadora')) setTab('calculator')
      else if (path.startsWith('/app/clientes')) setTab('clients')
      else if (path.startsWith('/app/prestamos')) setTab('loans')
      else if (path.startsWith('/app/pagos')) setTab('payments')
      else if (path.startsWith('/app/sucursales')) setTab('branches')
      else if (path.startsWith('/app/reportes')) setTab('reports')
      else if (path.startsWith('/app/mas')) setTab('more')
      else if (path.startsWith('/app/admin')) setTab('admin')
      else setTab('dashboard')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (orgAccess && !orgAccess.allowPremiumFeatures && isPremiumTab(tab)) {
      goToBillingUpgrade()
    }
  }, [goToBillingUpgrade, orgAccess, tab])

  useEffect(() => {
    const onGotoDashboard = () => changeTab('dashboard')
    window.addEventListener('lendstack:goto-dashboard', onGotoDashboard)
    return () => window.removeEventListener('lendstack:goto-dashboard', onGotoDashboard)
  }, [changeTab])

  useEffect(() => {
    const onNewLoan = () => {
      setSelectedLoanId(null)
      changeTab('loans')
      setLoanCreateRequestKey((value) => value + 1)
    }
    window.addEventListener('lendstack:new-loan', onNewLoan)
    return () => window.removeEventListener('lendstack:new-loan', onNewLoan)
  }, [changeTab])

  const termYears = termUnit === 'months' ? termValue / 12 : termValue
  const params: LoanParams = { amount, termYears, profile, currency, rateMode, customMonthlyRate }
  const config = getRiskConfig(profile)
  const result = calculateLoan(params)
  const weeklyResult = calculateWeeklyLoan(amount, weeklyTermWeeks, weeklyMonthlyRate)
  const carritoResult = calculateCarritoLoan(amount, carritoFlatRate, carritoTerm, carritoPayments)

  const handleTermUnitChange = (unit: 'years' | 'months') => {
    if (unit === termUnit) return
    if (unit === 'months') {
      setTermValue(Math.round(termValue * 12))
    } else {
      setTermValue(Math.max(1, Math.round(termValue / 12)))
    }
    setTermUnit(unit)
  }

  const handleLoadClient = useCallback((nextParams: LoanParams) => {
    setAmount(nextParams.amount)
    setTermUnit('years')
    setTermValue(nextParams.termYears)
    setProfile(nextParams.profile)
    setCurrency(nextParams.currency)
    changeTab('calculator')
    showToast('📂', 'Simulación de cliente cargada')
  }, [changeTab])

  const handleCurrencyChange = (nextCurrency: Currency) => {
    setCurrency(nextCurrency)
    showToast('💱', `Moneda cambiada a ${nextCurrency}`)
  }

  const handleRateModeChange = (nextMode: RateMode) => {
    setRateMode(nextMode)
    showToast(nextMode === 'monthly' ? '🗓️' : '📆', nextMode === 'monthly' ? 'Modo tasa mensual activado' : 'Modo tasa anual activado')
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <div className="hidden sm:block bg-white border-b border-slate-200" style={{ boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 py-3">
            <div>
              <p className="text-xs text-slate-400 font-semibold">LendStack Workspace</p>
              <h1 className="text-base font-display" style={{ color: '#0D2B5E' }}>{TAB_META[tab].title}</h1>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <input
                type="text"
                value={dashboardSearch}
                onChange={(event) => setDashboardSearch(event.target.value)}
                placeholder="Buscar clientes, préstamos o pagos..."
                className="w-72 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center overflow-x-auto">
            {DESKTOP_TABS.filter((item) => (!isPremiumTab(item.id) || canUsePremiumFeatures) && (item.id !== 'admin' || isMaster)).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  changeTab(item.id)
                  if (item.id !== 'clients') setSelectedClientId(null)
                  if (item.id !== 'loans') setSelectedLoanId(null)
                }}
                className="px-5 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0"
                style={{
                  borderBottomColor: tab === item.id ? '#1565C0' : 'transparent',
                  color: tab === item.id ? '#1565C0' : '#64748b',
                  background: 'transparent',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="relative max-w-7xl mx-auto w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 flex-1 pb-24 sm:pb-6">
        {tab === 'calculator' && (
          <LoanCalculatorPage
            amount={amount}
            onAmountChange={setAmount}
            currency={currency}
            onCurrencyChange={handleCurrencyChange}
            loanType={loanType}
            onLoanTypeChange={setLoanType}
            termUnit={termUnit}
            termValue={termValue}
            onTermUnitChange={handleTermUnitChange}
            onTermValueChange={setTermValue}
            rateMode={rateMode}
            onRateModeChange={handleRateModeChange}
            customMonthlyRate={customMonthlyRate}
            onCustomMonthlyRateChange={setCustomMonthlyRate}
            weeklyTermWeeks={weeklyTermWeeks}
            onWeeklyTermWeeksChange={setWeeklyTermWeeks}
            weeklyMonthlyRate={weeklyMonthlyRate}
            onWeeklyMonthlyRateChange={setWeeklyMonthlyRate}
            carritoFlatRate={carritoFlatRate}
            onCarritoFlatRateChange={setCarritoFlatRate}
            carritoTerm={carritoTerm}
            onCarritoTermChange={setCarritoTerm}
            carritoPayments={carritoPayments}
            onCarritoPaymentsChange={setCarritoPayments}
            carritoFreq={carritoFreq}
            onCarritoFreqChange={setCarritoFreq}
          />
        )}

        {tab === 'dashboard' && (
          <Dashboard
            externalSearch={dashboardSearch}
            onExternalSearchChange={setDashboardSearch}
            onViewProfile={(id) => {
              setSelectedClientId(id)
              changeTab('clients')
            }}
          />
        )}

        {tab === 'loans' && (
          selectedLoanId ? (
            <LoanDetailPanel
              loanId={selectedLoanId}
              onBack={() => setSelectedLoanId(null)}
              onViewBorrower={(clientId) => {
                setSelectedClientId(clientId)
                setTab('clients')
              }}
            />
          ) : (
            <LoansPanel
              onViewLoan={(id) => setSelectedLoanId(id)}
              createRequestKey={loanCreateRequestKey}
            />
          )
        )}

        {tab === 'clients' && (
          selectedClientId ? (
            <ClientProfilePanel
              clientId={selectedClientId}
              onBack={() => setSelectedClientId(null)}
              onViewLoan={(loanId) => {
                setSelectedLoanId(loanId)
                setTab('loans')
              }}
            />
          ) : (
            <ClientsPanel
              currentParams={params}
              currentResult={result}
              currentLoanType={loanType}
              weeklyResult={weeklyResult}
              weeklyTermWeeks={weeklyTermWeeks}
              weeklyMonthlyRate={weeklyMonthlyRate}
              carritoResult={carritoResult}
              carritoFlatRate={carritoFlatRate}
              carritoTerm={carritoTerm}
              carritoPayments={carritoPayments}
              carritoFreq={carritoFreq}
              onLoadClient={handleLoadClient}
              onViewProfile={(id) => setSelectedClientId(id)}
            />
          )
        )}

        {tab === 'payments' && (
          <PaymentsHub
            onQuickPay={() => setShowPayment(true)}
            onViewClient={(clientId) => {
              setSelectedClientId(clientId)
              changeTab('clients')
            }}
            onViewLoans={() => changeTab('loans')}
          />
        )}

        {tab === 'more' && (
          <MoreScreen
            isMaster={isMaster}
            userName={session?.user?.name}
            userEmail={session?.user?.email}
            onGoCalculator={() => changeTab('calculator')}
            onGoBranches={() => (canUsePremiumFeatures ? changeTab('branches') : goToBillingUpgrade())}
            onGoReports={() => (canUsePremiumFeatures ? changeTab('reports') : goToBillingUpgrade())}
            onGoNotifications={() => { window.location.href = '/app/notificaciones' }}
            onGoSettings={() => showToast('⚙️', 'Configuración avanzada próximamente')}
            onGoHelp={() => showToast('🆘', 'Centro de ayuda próximamente')}
            onLogoutEvent={() => window.dispatchEvent(new Event('lendstack:logout'))}
          />
        )}

        {tab === 'admin' && !isMaster && (
          <Dashboard
            onViewProfile={(id) => {
              setSelectedClientId(id)
              changeTab('clients')
            }}
          />
        )}

        {tab === 'admin' && isMaster && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5" style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
              <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Administración</p>
              <h2 className="text-lg font-display" style={{ color: '#0D2B5E' }}>Centro administrativo</h2>
              <p className="text-sm text-slate-500 mt-2">Gestioná usuarios, sucursales y políticas operativas desde una sola vista.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <a href="/admin/users" className="min-h-12 rounded-xl border border-amber-200 bg-amber-50 text-sm font-semibold flex items-center justify-center" style={{ color: '#92400E' }}>
                  👥 Configurar usuarios
                </a>
                <a href="/admin/branches" className="min-h-12 rounded-xl border border-sky-200 bg-sky-50 text-sm font-semibold flex items-center justify-center" style={{ color: '#0369A1' }}>
                  🏢 Configurar sucursales
                </a>
              </div>
            </div>
          </div>
        )}

        {tab === 'branches' && (
          <BranchesPanel
            onViewProfile={(id) => {
              setSelectedClientId(id)
              changeTab('clients')
            }}
          />
        )}

        {tab === 'reports' && <OrganizationReport />}
      </main>

      <footer className="hidden sm:block bg-white border-t border-slate-200 text-center py-5 text-xs text-slate-400 mt-4">
        <strong style={{ color: '#0D2B5E' }}>LendStack</strong> · Herramienta de análisis financiero · Los cálculos son referenciales y no constituyen asesoramiento financiero.
      </footer>

      <MobileBottomNav
        items={MOBILE_TABS}
        activeId={tab}
        onSelect={(id) => {
          const next = id as Tab
          changeTab(next)
          if (next !== 'clients') setSelectedClientId(null)
          if (next !== 'loans') setSelectedLoanId(null)
        }}
      />

      <EmailModal isOpen={emailOpen} onClose={() => setEmailOpen(false)} params={params} result={result} config={config} />
      <QuickPaymentModal isOpen={showPayment} onClose={() => setShowPayment(false)} />
      <ToastProvider />
    </div>
  )
}

export default function Home() {
  return <HomeWithTab initialTab="dashboard" />
}
