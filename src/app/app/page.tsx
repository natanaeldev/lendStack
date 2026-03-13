'use client'

import { useState, useCallback, useEffect } from 'react'
import Header from '@/components/Header'
import MobileBottomNav from '@/components/app-shell/MobileBottomNav'
import MoreScreen from '@/components/app-shell/MoreScreen'
import CurrencyToggle from '@/components/CurrencyToggle'
import RateModeToggle from '@/components/RateModeToggle'
import RiskSelector from '@/components/RiskSelector'
import ResultsPanel from '@/components/ResultsPanel'
import AmortizationChart from '@/components/AmortizationChart'
import AmortizationTable from '@/components/AmortizationTable'
import PaymentScheduleTable from '@/components/PaymentScheduleTable'
import ComparisonPanel from '@/components/ComparisonPanel'
import MultiLoanPanel from '@/components/MultiLoanPanel'
import ClientsPanel from '@/components/ClientsPanel'
import ClientProfilePanel from '@/components/ClientProfilePanel'
import LoansPanel from '@/components/LoansPanel'
import LoanDetailPanel from '@/components/LoanDetailPanel'
import Dashboard from '@/components/Dashboard'
import LoanCalculatorPage from '@/components/calculator/LoanCalculatorPage'
import BranchesPanel from '@/components/BranchesPanel'
import OrganizationReport from '@/components/OrganizationReport'
import PaymentsHub from '@/components/PaymentsHub'
import QuickPaymentModal from '@/components/QuickPaymentModal'
import PdfExportButton from '@/components/PdfExport'
import EmailModal from '@/components/EmailModal'
import ToastProvider, { showToast } from '@/components/Toast'
import { useSession } from 'next-auth/react'
import {
  calculateLoan, buildAmortization, getRiskConfig,
  calculateWeeklyLoan, buildWeeklySchedule,
  calculateCarritoLoan, buildCarritoSchedule,
  RiskProfile, Currency, RateMode, LoanParams, LoanType, CarritoFrequency,
  LOAN_TYPES,
  formatCurrency, formatPercent, CURRENCIES,
} from '@/lib/loan'

export type Tab = 'calculator' | 'dashboard' | 'clients' | 'loans' | 'branches' | 'reports' | 'payments' | 'more' | 'admin'
type CalcSubTab = 'single' | 'multiloan' | 'comparison'

const DESKTOP_TABS: { id: Tab; label: string; emoji: string; mobileLabel: string; icon: string }[] = [
  { id: 'dashboard',  label: 'Dashboard',   emoji: '🏠', icon: '🏠', mobileLabel: 'Inicio'      },
  { id: 'loans',      label: 'Préstamos',   emoji: '📋', icon: '📋', mobileLabel: 'Préstamos'  },
  { id: 'clients',    label: 'Clientes',    emoji: '👥', icon: '👥', mobileLabel: 'Clientes'   },
  { id: 'payments',   label: 'Pagos',       emoji: '💵', icon: '💵', mobileLabel: 'Pagos'      },
  { id: 'branches',   label: 'Sucursales',  emoji: '🏢', icon: '🏢', mobileLabel: 'Sucursales' },
  { id: 'reports',    label: 'Reportes',    emoji: '📑', icon: '📑', mobileLabel: 'Reportes'   },
  { id: 'admin',      label: 'Admin',       emoji: '⚙️', icon: '⚙️', mobileLabel: 'Admin'      },
  { id: 'calculator', label: 'Calculadora', emoji: '🧮', icon: '🧮', mobileLabel: 'Calcular'   },
]

const MOBILE_TABS: { id: Tab; label: string; mobileLabel: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Inicio', icon: '🏠' },
  { id: 'loans', label: 'Préstamos', mobileLabel: 'Préstamos', icon: '📋' },
  { id: 'clients', label: 'Clientes', mobileLabel: 'Clientes', icon: '👥' },
  { id: 'payments', label: 'Pagos', mobileLabel: 'Pagos', icon: '💵' },
  { id: 'more', label: 'Más', mobileLabel: 'Más', icon: '☰' },
]

const CALC_SUBTABS: { id: CalcSubTab; label: string }[] = [
  { id: 'single',     label: 'Simulación'     },
  { id: 'multiloan',  label: 'Multi-préstamo' },
  { id: 'comparison', label: 'Comparación'    },
]

const TAB_META: Record<Tab, { title: string; description: string }> = {
  dashboard:  { title: 'Dashboard', description: 'Visión general de cartera y rendimiento diario.' },
  loans:      { title: 'Préstamos', description: 'Gestioná originación, estado y cobranza de préstamos.' },
  clients:    { title: 'Clientes', description: 'Perfiles, documentos y seguimiento de prestatarios.' },
  payments:   { title: 'Pagos', description: 'Registro rápido de cobros y seguimiento de cobranza.' },
  branches:   { title: 'Sucursales', description: 'Control operativo por oficina y equipos.' },
  reports:    { title: 'Reportes', description: 'KPIs exportables y análisis financiero ejecutivo.' },
  calculator: { title: 'Calculadora', description: 'Simulación y comparación avanzada de escenarios.' },
  more:       { title: 'Más', description: 'Acciones secundarias, configuración y soporte.' },
  admin:      { title: 'Administración', description: 'Configuración de usuarios, sucursales y permisos.' },
}

export function HomeWithTab({ initialTab = 'dashboard' }: { initialTab?: Tab }) {
  const { data: session } = useSession()
  const isMaster = session?.user?.role === 'master'
  const [tab,               setTab]               = useState<Tab>(initialTab)
  const [calcSubTab,        setCalcSubTab]        = useState<CalcSubTab>('single')
  const [selectedClientId,  setSelectedClientId]  = useState<string | null>(null)
  const [selectedLoanId,    setSelectedLoanId]    = useState<string | null>(null)
  const [loanCreateRequestKey, setLoanCreateRequestKey] = useState(0)
  const [showPayment,       setShowPayment]        = useState(false)
  const [amount,            setAmount]            = useState(100000)
  const [termUnit,          setTermUnit]          = useState<'years' | 'months'>('years')
  const [termValue,         setTermValue]         = useState(5)          // in the selected unit
  const [profile,           setProfile]           = useState<RiskProfile>('Medium Risk')
  const [currency,          setCurrency]          = useState<Currency>('USD')
  const [rateMode,          setRateMode]          = useState<RateMode>('annual')
  const [customMonthlyRate, setCustomMonthlyRate] = useState(0.015)
  const [showTable,         setShowTable]         = useState(false)
  const [emailOpen,         setEmailOpen]         = useState(false)

  // ── Loan type ──
  const [loanType,          setLoanType]          = useState<LoanType>('amortized')
  // Weekly loan
  const [weeklyTermWeeks,   setWeeklyTermWeeks]   = useState(52)
  const [weeklyMonthlyRate, setWeeklyMonthlyRate] = useState(0.05)
  // Carrito loan
  const [carritoFlatRate,   setCarritoFlatRate]   = useState(0.20)
  const [carritoTerm,       setCarritoTerm]       = useState(4)
  const [carritoPayments,   setCarritoPayments]   = useState(4)
  const [carritoFreq,       setCarritoFreq]       = useState<CarritoFrequency>('weekly')

  // ── URL-synced tab navigation ──────────────────────────────────────────────
  const changeTab = useCallback((newTab: Tab) => {
    setTab(newTab)
    if (typeof window !== 'undefined') {
      const paths: Record<Tab, string> = {
        dashboard:  '/app',
        calculator: '/app/calculadora',
        clients:    '/app/clientes',
        loans:      '/app/prestamos',
        payments:   '/app/pagos',
        branches:   '/app/sucursales',
        reports:    '/app/reportes',
        more:       '/app/mas',
        admin:      '/app/admin',
      }
      window.history.pushState(null, '', paths[newTab])
    }
  }, [])

  // Keep tab in sync when browser Back / Forward is used
  useEffect(() => {
    const onPopState = () => {
      const p = window.location.pathname
      if (p.startsWith('/app/calculadora'))     setTab('calculator')
      else if (p.startsWith('/app/clientes'))   setTab('clients')
      else if (p.startsWith('/app/prestamos'))  setTab('loans')
      else if (p.startsWith('/app/pagos'))      setTab('payments')
      else if (p.startsWith('/app/sucursales')) setTab('branches')
      else if (p.startsWith('/app/reportes'))   setTab('reports')
      else if (p.startsWith('/app/mas'))        setTab('more')
      else if (p.startsWith('/app/admin'))      setTab('admin')
      else                                       setTab('dashboard')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Reset to dashboard when the Header logo is clicked.
  // Needed because Next.js skips navigation when the real route is
  // already /app (even if pushState changed the visible URL to a sub-path).
  useEffect(() => {
    const onGotoDashboard = () => changeTab('dashboard')
    window.addEventListener('lendstack:goto-dashboard', onGotoDashboard)
    return () => window.removeEventListener('lendstack:goto-dashboard', onGotoDashboard)
  }, [changeTab])

  // Route new-loan entry points into Prestamos and open the in-place flow.
  useEffect(() => {
    const onNewLoan = () => {
      setSelectedLoanId(null)
      changeTab('loans')
      setLoanCreateRequestKey((value) => value + 1)
    }
    window.addEventListener('lendstack:new-loan', onNewLoan)
    return () => window.removeEventListener('lendstack:new-loan', onNewLoan)
  }, [changeTab])

  // Always pass termYears to the calculation layer (convert months → fractional years)
  const termYears = termUnit === 'months' ? termValue / 12 : termValue

  const handleTermUnitChange = (unit: 'years' | 'months') => {
    if (unit === termUnit) return
    // Convert current value when switching units
    if (unit === 'months') {
      setTermValue(Math.round(termValue * 12))   // years → months
    } else {
      setTermValue(Math.max(1, Math.round(termValue / 12)))  // months → years
    }
    setTermUnit(unit)
  }

  const params: LoanParams = { amount, termYears, profile, currency, rateMode, customMonthlyRate }
  const config = getRiskConfig(profile)
  const result = calculateLoan(params)
  const rows   = buildAmortization(params)
  const fmt    = (v: number) => formatCurrency(v, currency)

  // Weekly
  const weeklyResult   = calculateWeeklyLoan(amount, weeklyTermWeeks, weeklyMonthlyRate)
  const weeklySchedule = buildWeeklySchedule(amount, weeklyTermWeeks, weeklyMonthlyRate)
  // Carrito
  const carritoResult   = calculateCarritoLoan(amount, carritoFlatRate, carritoTerm, carritoPayments)
  const carritoSchedule = buildCarritoSchedule(amount, carritoFlatRate, carritoTerm, carritoPayments, carritoFreq)

  const handleLoadClient = useCallback((p: LoanParams) => {
    setAmount(p.amount)
    setTermUnit('years')           // clients always saved with termYears in years
    setTermValue(p.termYears)
    setProfile(p.profile)
    setCurrency(p.currency)
    changeTab('calculator')
    showToast('📂', 'Simulación de cliente cargada')
  }, [changeTab])

  const handleCurrencyChange = (c: Currency) => {
    setCurrency(c)
    showToast('💱', `Moneda cambiada a ${c}`)
  }

  const handleRateModeChange = (m: RateMode) => {
    setRateMode(m)
    showToast(m === 'monthly' ? '🗓️' : '📅', m === 'monthly' ? 'Modo tasa mensual activado' : 'Modo tasa anual activado')
  }

  const card = 'rounded-2xl p-4 sm:p-6 bg-white border border-slate-200 mb-5'
  const cardShadow = { boxShadow: '0 2px 18px rgba(0,0,0,.06)' }
  const sectionTitle = (text: string) => (
    <div className="flex items-center gap-2.5 mb-5">
      <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(180deg, #1565C0, #0D2B5E)' }} />
      <h2 className="font-display text-base" style={{ color: '#0D2B5E' }}>{text}</h2>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />


      {/* ── Top workspace bar (sm+) ── */}
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
                placeholder="Buscar clientes, préstamos o pagos..."
                className="w-72 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
              />
              <button className="w-9 h-9 rounded-xl border border-slate-200 text-slate-500" aria-label="Notificaciones">🔔</button>
              <button
                onClick={() => setShowPayment(true)}
                title="Registrar pago de cuota"
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-lg transition-all hover:scale-110 active:scale-95"
                style={{ background: 'linear-gradient(135deg,#1565C0,#0D2B5E)', boxShadow: '0 2px 8px rgba(21,101,192,.4)' }}>
                +
              </button>
            </div>
          </div>
          <div className="flex items-center overflow-x-auto">
            {DESKTOP_TABS.filter(t => t.id !== 'admin' || isMaster).map(t => (
              <button key={t.id} onClick={() => { changeTab(t.id); if (t.id !== 'clients') setSelectedClientId(null); if (t.id !== 'loans') setSelectedLoanId(null) }}
                className="px-5 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0"
                style={{ borderBottomColor: tab === t.id ? '#1565C0' : 'transparent', color: tab === t.id ? '#1565C0' : '#64748b', background: 'transparent', fontFamily: "'DM Sans', sans-serif" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>


      <main className="relative max-w-7xl mx-auto w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 flex-1 pb-24 sm:pb-6">

        {/* ═══ CALCULATOR ═══ */}
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

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <Dashboard
            onViewProfile={(id) => {
              setSelectedClientId(id)
              changeTab('clients')
            }}
          />
        )}

        {/* ═══ LOANS ═══ */}
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

        {/* ═══ CLIENTS ═══ */}
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

        {/* ═══ PAYMENTS ═══ */}
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


        {/* ═══ MORE ═══ */}
        {tab === 'more' && (
          <MoreScreen
            isMaster={isMaster}
            userName={session?.user?.name}
            userEmail={session?.user?.email}
            onGoCalculator={() => changeTab('calculator')}
            onGoBranches={() => changeTab('branches')}
            onGoReports={() => changeTab('reports')}
            onGoNotifications={() => showToast('🔔', 'Centro de notificaciones próximamente')}
            onGoSettings={() => showToast('⚙️', 'Configuración avanzada próximamente')}
            onGoHelp={() => showToast('🆘', 'Centro de ayuda próximamente')}
            onLogoutEvent={() => window.dispatchEvent(new Event('lendstack:logout'))}
          />
        )}

        {/* ═══ ADMIN ═══ */}
        {tab === 'admin' && !isMaster && (<Dashboard onViewProfile={(id) => { setSelectedClientId(id); changeTab('clients') }} />)}

        {tab === 'admin' && isMaster && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5" style={{ boxShadow: '0 2px 18px rgba(0,0,0,.06)' }}>
              <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Administración</p>
              <h2 className="text-lg font-display" style={{ color: '#0D2B5E' }}>Centro administrativo</h2>
              <p className="text-sm text-slate-500 mt-2">Gestioná usuarios, sucursales y políticas operativas desde una sola vista.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <a href="/admin/users" className="min-h-12 rounded-xl border border-amber-200 bg-amber-50 text-sm font-semibold flex items-center justify-center" style={{ color: '#92400E' }}>👥 Configurar usuarios</a>
                <a href="/admin/branches" className="min-h-12 rounded-xl border border-sky-200 bg-sky-50 text-sm font-semibold flex items-center justify-center" style={{ color: '#0369A1' }}>🏢 Configurar sucursales</a>
              </div>
            </div>
          </div>
        )}

        {/* ═══ BRANCHES ═══ */}
        {tab === 'branches' && (
          <BranchesPanel
            onViewProfile={(id) => {
              setSelectedClientId(id)
              changeTab('clients')
            }}
          />
        )}

        {/* ═══ REPORTS ═══ */}
        {tab === 'reports' && <OrganizationReport />}

      </main>

      {/* Footer — hidden on mobile (bottom nav takes the space) */}
      <footer className="hidden sm:block bg-white border-t border-slate-200 text-center py-5 text-xs text-slate-400 mt-4">
        <strong style={{ color: '#0D2B5E' }}>LendStack</strong> · Herramienta de análisis financiero ·
        Los cálculos son referenciales y no constituyen asesoramiento financiero.
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


      {/* Modals & notifications */}
      <EmailModal isOpen={emailOpen} onClose={() => setEmailOpen(false)} params={params} result={result} config={config} />
      <QuickPaymentModal isOpen={showPayment} onClose={() => setShowPayment(false)} />
      <ToastProvider />
    </div>
  )
}

// Default export for /app route (dashboard as home)
export default function Home() {
  return <HomeWithTab initialTab="dashboard" />
}
