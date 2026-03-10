'use client'

import { useState, useCallback, useEffect } from 'react'
import Header from '@/components/Header'
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
import BranchesPanel from '@/components/BranchesPanel'
import QuickPaymentModal from '@/components/QuickPaymentModal'
import PdfExportButton from '@/components/PdfExport'
import EmailModal from '@/components/EmailModal'
import ToastProvider, { showToast } from '@/components/Toast'
import {
  calculateLoan, buildAmortization, getRiskConfig,
  calculateWeeklyLoan, buildWeeklySchedule,
  calculateCarritoLoan, buildCarritoSchedule,
  RiskProfile, Currency, RateMode, LoanParams, LoanType, CarritoFrequency,
  LOAN_TYPES,
  formatCurrency, formatPercent, CURRENCIES,
} from '@/lib/loan'

export type Tab = 'calculator' | 'dashboard' | 'clients' | 'loans' | 'branches'
type CalcSubTab = 'single' | 'multiloan' | 'comparison'

const TABS: { id: Tab; label: string; emoji: string; mobileLabel: string }[] = [
  { id: 'dashboard',  label: '🏠 Dashboard',   emoji: '🏠', mobileLabel: 'Inicio'      },
  { id: 'loans',      label: '📋 Préstamos',   emoji: '📋', mobileLabel: 'Préstamos'  },
  { id: 'clients',    label: '👥 Clientes',     emoji: '👥', mobileLabel: 'Clientes'   },
  { id: 'branches',   label: '🏢 Sucursales',   emoji: '🏢', mobileLabel: 'Sucursales' },
  { id: 'calculator', label: '🧮 Calculadora',  emoji: '🧮', mobileLabel: 'Calcular'   },
]

const CALC_SUBTABS: { id: CalcSubTab; label: string }[] = [
  { id: 'single',     label: 'Simulación'     },
  { id: 'multiloan',  label: 'Multi-préstamo' },
  { id: 'comparison', label: 'Comparación'    },
]

export function HomeWithTab({ initialTab = 'dashboard' }: { initialTab?: Tab }) {
  const [tab,               setTab]               = useState<Tab>(initialTab)
  const [calcSubTab,        setCalcSubTab]        = useState<CalcSubTab>('single')
  const [selectedClientId,  setSelectedClientId]  = useState<string | null>(null)
  const [selectedLoanId,    setSelectedLoanId]    = useState<string | null>(null)
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
        branches:   '/app/sucursales',
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
      else if (p.startsWith('/app/sucursales')) setTab('branches')
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

  // Navigate to clients tab (new loan form) when header button is clicked
  useEffect(() => {
    const onNewLoan = () => changeTab('clients')
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
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* ── Desktop tab bar (sm+) ── */}
      <div className="hidden sm:block sticky top-0 z-40 bg-white border-b border-slate-200" style={{ boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
        <div className="max-w-6xl mx-auto px-6 flex items-center overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { changeTab(t.id); if (t.id !== 'clients') setSelectedClientId(null); if (t.id !== 'loans') setSelectedLoanId(null) }}
              className="px-5 py-3.5 text-xs sm:text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0"
              style={{ borderBottomColor: tab === t.id ? '#1565C0' : 'transparent', color: tab === t.id ? '#1565C0' : '#64748b', background: 'transparent', fontFamily: "'DM Sans', sans-serif" }}>
              {t.label}
            </button>
          ))}
          <div className="ml-auto pl-4 flex-shrink-0">
            <button
              onClick={() => setShowPayment(true)}
              title="Registrar pago de cuota"
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-lg transition-all hover:scale-110 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#1565C0,#0D2B5E)', boxShadow: '0 2px 8px rgba(21,101,192,.4)' }}>
              +
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 flex-1 pb-24 sm:pb-6">

        {/* ═══ CALCULATOR ═══ */}
        {tab === 'calculator' && (
          <>
            {/* Sub-nav */}
            <div className="flex items-center gap-1 mb-5 p-1 rounded-2xl bg-slate-100 border border-slate-200 w-full sm:w-fit">
              {CALC_SUBTABS.map(s => (
                <button key={s.id} onClick={() => setCalcSubTab(s.id)}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all text-center"
                  style={{
                    background: calcSubTab === s.id ? '#fff' : 'transparent',
                    color:      calcSubTab === s.id ? '#0D2B5E' : '#64748b',
                    boxShadow:  calcSubTab === s.id ? '0 1px 6px rgba(0,0,0,.1)' : 'none',
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                  <span className="hidden sm:inline">{s.id === 'single' ? '🧮' : s.id === 'multiloan' ? '📋' : '📊'} </span>
                  <span className="sm:hidden text-base leading-none block mb-0.5">{s.id === 'single' ? '🧮' : s.id === 'multiloan' ? '📋' : '📊'}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.id === 'single' ? 'Simular' : s.id === 'multiloan' ? 'Multi' : 'Comparar'}</span>
                </button>
              ))}
            </div>

            {/* ── Single loan (Simulación) ── */}
            {calcSubTab === 'single' && <>
            {/* ── Loan type selector ── */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {LOAN_TYPES.map(lt => (
                <button key={lt.id} onClick={() => setLoanType(lt.id)}
                  className="flex-1 min-w-[120px] flex flex-col items-start gap-1 px-4 py-3 rounded-xl border-2 transition-all text-left"
                  style={{
                    borderColor:  loanType === lt.id ? '#1565C0' : '#e2e8f0',
                    background:   loanType === lt.id ? '#EEF4FF' : '#fff',
                    boxShadow:    loanType === lt.id ? '0 0 0 3px #1565C022' : 'none',
                  }}>
                  <span className="text-xl">{lt.emoji}</span>
                  <span className="text-xs font-bold" style={{ color: loanType === lt.id ? '#1565C0' : '#0D2B5E' }}>{lt.label}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{lt.description}</span>
                </button>
              ))}
            </div>

            {/* Inputs */}
            <div className={card} style={cardShadow}>
              <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
                {sectionTitle('Parámetros del préstamo')}
                <CurrencyToggle value={currency} onChange={handleCurrencyChange} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Monto del préstamo ({currency})
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                      {CURRENCIES[currency].symbol}
                    </span>
                    <input type="number" value={amount} min={1000} step={1000}
                      onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-slate-200 text-lg font-display font-bold focus:outline-none focus:border-blue-500 transition-colors"
                      style={{ color: '#0D2B5E' }} />
                  </div>
                  <input type="range" min={1000} max={1000000} step={1000} value={Math.min(amount, 1000000)}
                    onChange={e => setAmount(Number(e.target.value))}
                    className="w-full mt-3 accent-blue-600" style={{ height: 4 }} />
                  <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                    <span>{fmt(1000)}</span><span>{fmt(1000000)}</span>
                  </div>
                </div>

                {/* Term */}
                <div>
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Plazo
                    </label>
                    {/* Years / Months unit toggle */}
                    <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50 text-xs font-bold">
                      {(['years', 'months'] as const).map(unit => (
                        <button key={unit} onClick={() => handleTermUnitChange(unit)}
                          className="px-2.5 py-1 transition-all"
                          style={{
                            background: termUnit === unit ? '#1565C0' : 'transparent',
                            color:      termUnit === unit ? '#fff' : '#64748b',
                          }}>
                          {unit === 'years' ? 'Años' : 'Meses'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <input type="number" value={termValue}
                      min={1} max={termUnit === 'months' ? 360 : 30}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        const max = termUnit === 'months' ? 360 : 30
                        if (!isNaN(v) && v >= 1 && v <= max) setTermValue(v)
                      }}
                      className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-slate-200 text-lg font-display font-bold focus:outline-none focus:border-blue-500 transition-colors"
                      style={{ color: '#0D2B5E' }} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 pointer-events-none">
                      {termUnit === 'months' ? 'meses' : 'años'}
                    </span>
                  </div>
                  <input type="range" min={1} max={termUnit === 'months' ? 360 : 30} step={1}
                    value={termValue}
                    onChange={e => setTermValue(Number(e.target.value))}
                    className="w-full mt-3 accent-blue-600" style={{ height: 4 }} />
                  <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                    {termUnit === 'months'
                      ? <><span>1 mes</span><span>180 meses</span><span>360 meses</span></>
                      : <><span>1 año</span><span>30 años</span></>
                    }
                  </div>
                  {/* Show equivalent in the other unit */}
                  <p className="text-xs text-slate-400 mt-1.5">
                    {termUnit === 'months'
                      ? <>≈ <strong style={{ color: '#0D2B5E' }}>{(termValue / 12).toFixed(1)}</strong> años · <strong style={{ color: '#0D2B5E' }}>{termValue}</strong> cuotas</>
                      : <><strong style={{ color: '#0D2B5E' }}>{termValue * 12}</strong> meses · <strong style={{ color: '#0D2B5E' }}>{termValue * 12}</strong> cuotas</>
                    }
                  </p>
                </div>
              </div>

              {/* ── Amortized-only: rate mode + risk ── */}
              {loanType === 'amortized' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Base de tasa de interés
                      </label>
                      <RateModeToggle value={rateMode} onChange={handleRateModeChange} />
                    </div>

                    {rateMode === 'monthly' && (
                      <div className="rounded-xl p-4 border-2 mb-4"
                        style={{ borderColor: '#1565C044', background: '#f0f4fa' }}>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                          Tasa mensual (%)
                        </label>
                        <div className="flex items-baseline gap-3 flex-wrap">
                          <div className="relative">
                            <input
                              type="number"
                              value={(customMonthlyRate * 100).toFixed(2)}
                              min={0.01} max={20} step={0.01}
                              onChange={e => {
                                const v = parseFloat(e.target.value)
                                if (!isNaN(v) && v >= 0) setCustomMonthlyRate(v / 100)
                              }}
                              className="w-28 pl-3 pr-8 py-2.5 rounded-xl border-2 border-slate-200 text-lg font-display font-bold focus:outline-none focus:border-blue-500 transition-colors"
                              style={{ color: '#0D2B5E' }}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span>
                          </div>
                          <span className="text-xs font-semibold" style={{ color: '#1565C0' }}>/ mes</span>
                          <span className="text-xs text-slate-400 ml-auto">
                            ≈ <strong style={{ color: '#0D2B5E' }}>{(customMonthlyRate * 12 * 100).toFixed(2)}%</strong> anual equivalente
                          </span>
                        </div>
                        <input type="range" min={0.01} max={20} step={0.01}
                          value={+(customMonthlyRate * 100).toFixed(2)}
                          onChange={e => setCustomMonthlyRate(parseFloat(e.target.value) / 100)}
                          className="w-full mt-3 accent-blue-600" style={{ height: 4 }} />
                        <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                          <span>0.01%</span><span>10%</span><span>20%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                      Perfil de riesgo
                      {rateMode === 'monthly' && (
                        <span className="ml-2 font-normal normal-case tracking-normal text-blue-400">
                          (solo categorización — la tasa es manual)
                        </span>
                      )}
                    </label>
                    <RiskSelector value={profile} onChange={setProfile} rateMode={rateMode} />
                  </div>
                </>
              )}

              {/* ── Weekly-only fields ── */}
              {loanType === 'weekly' && (
                <div className="rounded-xl p-4 border-2 mb-4" style={{ borderColor: '#1565C044', background: '#f0f4fa' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        Plazo (semanas)
                      </label>
                      <div className="relative">
                        <input type="number" value={weeklyTermWeeks} min={1} max={520} step={1}
                          onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1 && v <= 520) setWeeklyTermWeeks(v) }}
                          className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-slate-200 text-lg font-display font-bold focus:outline-none focus:border-blue-500 transition-colors"
                          style={{ color: '#0D2B5E' }} />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 pointer-events-none">sem.</span>
                      </div>
                      <input type="range" min={1} max={520} step={1} value={weeklyTermWeeks}
                        onChange={e => setWeeklyTermWeeks(Number(e.target.value))}
                        className="w-full mt-2 accent-blue-600" style={{ height: 4 }} />
                      <p className="text-xs text-slate-400 mt-1">≈ <strong style={{ color: '#0D2B5E' }}>{(weeklyTermWeeks / 4.33).toFixed(1)}</strong> meses</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        Tasa mensual (%) — se convierte a semanal
                      </label>
                      <div className="relative">
                        <input type="number" value={(weeklyMonthlyRate * 100).toFixed(2)} min={0.01} max={30} step={0.01}
                          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) setWeeklyMonthlyRate(v / 100) }}
                          className="w-full pl-4 pr-8 py-3 rounded-xl border-2 border-slate-200 text-lg font-display font-bold focus:outline-none focus:border-blue-500 transition-colors"
                          style={{ color: '#0D2B5E' }} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span>
                      </div>
                      <input type="range" min={0.01} max={30} step={0.01} value={+(weeklyMonthlyRate * 100).toFixed(2)}
                        onChange={e => setWeeklyMonthlyRate(parseFloat(e.target.value) / 100)}
                        className="w-full mt-2 accent-blue-600" style={{ height: 4 }} />
                      <p className="text-xs text-slate-400 mt-1">
                        Tasa semanal: <strong style={{ color: '#0D2B5E' }}>{formatPercent(weeklyMonthlyRate / 4.33, 4)}</strong>
                        &nbsp;·&nbsp;Anual equiv.: <strong style={{ color: '#0D2B5E' }}>{formatPercent(weeklyMonthlyRate * 12)}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Carrito-only fields ── */}
              {loanType === 'carrito' && (
                <div className="rounded-xl p-4 border-2 mb-4" style={{ borderColor: '#F59E0B44', background: '#FFFBF0' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        Tasa plana (%) — sobre capital total
                      </label>
                      <div className="relative">
                        <input type="number" value={(carritoFlatRate * 100).toFixed(1)} min={0.1} max={200} step={0.1}
                          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) setCarritoFlatRate(v / 100) }}
                          className="w-full pl-4 pr-8 py-3 rounded-xl border-2 border-slate-200 text-lg font-display font-bold focus:outline-none focus:border-blue-500 transition-colors"
                          style={{ color: '#0D2B5E' }} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span>
                      </div>
                      <input type="range" min={0.1} max={100} step={0.1} value={+(carritoFlatRate * 100).toFixed(1)}
                        onChange={e => setCarritoFlatRate(parseFloat(e.target.value) / 100)}
                        className="w-full mt-2 accent-amber-400" style={{ height: 4 }} />
                      <p className="text-xs text-slate-400 mt-1">Interés total: <strong style={{ color: '#F59E0B' }}>{fmt(carritoResult.totalInterest)}</strong></p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        Plazo (períodos)
                      </label>
                      <div className="relative">
                        <input type="number" value={carritoTerm} min={1} max={104} step={1}
                          onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) setCarritoTerm(v) }}
                          className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-slate-200 text-lg font-display font-bold focus:outline-none focus:border-blue-500 transition-colors"
                          style={{ color: '#0D2B5E' }} />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 pointer-events-none">períodos</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        Número de cuotas
                      </label>
                      <div className="relative">
                        <input type="number" value={carritoPayments} min={1} max={730} step={1}
                          onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) setCarritoPayments(v) }}
                          className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-slate-200 text-lg font-display font-bold focus:outline-none focus:border-blue-500 transition-colors"
                          style={{ color: '#0D2B5E' }} />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 pointer-events-none">cuotas</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        Frecuencia de pago
                      </label>
                      <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50 text-sm font-bold w-full">
                        {(['daily', 'weekly'] as const).map(f => (
                          <button key={f} onClick={() => setCarritoFreq(f)}
                            className="flex-1 py-3 transition-all"
                            style={{ background: carritoFreq === f ? '#1565C0' : 'transparent', color: carritoFreq === f ? '#fff' : '#64748b' }}>
                            {f === 'daily' ? '📆 Diario' : '📅 Semanal'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Results — Amortized ── */}
            {loanType === 'amortized' && (
              <>
                <div className="mb-5 fade-up-1">
                  <ResultsPanel result={result} config={config} currency={currency} rateMode={rateMode} />
                </div>
                <div className="flex gap-3 flex-wrap mb-5 fade-up-2">
                  <PdfExportButton params={params} result={result} config={config} />
                  <button onClick={() => setEmailOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 border-2"
                    style={{ color: '#1565C0', borderColor: '#1565C0' }}>
                    ✉️ Enviar por email
                  </button>
                  <button onClick={() => { changeTab('clients'); showToast('👤', 'Completa los datos del cliente') }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-slate-200 bg-slate-100 text-slate-700">
                    👤 Guardar como cliente
                  </button>
                </div>
                <div className={card + ' fade-up-2'} style={cardShadow}>
                  {sectionTitle('Evolución del préstamo')}
                  <AmortizationChart rows={rows} accentColor={config.colorAccent} currency={currency} />
                </div>
                <div className="fade-up-3">
                  <button onClick={() => setShowTable(s => !s)}
                    className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all mb-4"
                    style={{ background: showTable ? '#0D2B5E' : '#e8eef7', color: showTable ? '#fff' : '#0D2B5E', border: `1px solid ${showTable ? '#0D2B5E' : '#c5d5ea'}` }}>
                    {showTable ? '▲ Ocultar tabla' : '▼ Ver tabla de amortización'}
                  </button>
                  {showTable && (
                    <div className={card} style={cardShadow}>
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                        {sectionTitle(`Tabla de amortización — ${result.totalMonths} cuotas`)}
                        <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: config.colorBg, color: config.colorText }}>
                          {config.emoji} {profile}
                        </span>
                      </div>
                      <AmortizationTable rows={rows} accentColor={config.colorAccent} currency={currency} />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Results — Weekly ── */}
            {loanType === 'weekly' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 fade-up-1">
                  {[
                    { label: 'Cuota semanal',   value: fmt(weeklyResult.weeklyPayment),   sub: `× ${weeklyResult.totalWeeks} semanas` },
                    { label: 'Total a pagar',    value: fmt(weeklyResult.totalPayment),    sub: 'Capital + intereses' },
                    { label: 'Total intereses',  value: fmt(weeklyResult.totalInterest),   sub: `${formatPercent(weeklyResult.interestRatio)} del capital` },
                    { label: 'Tasa semanal',     value: formatPercent(weeklyResult.weeklyRate, 4), sub: `≈ ${formatPercent(weeklyResult.monthlyRate)} mensual` },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-4 border border-slate-200 bg-white" style={{ boxShadow: '0 1px 6px rgba(0,0,0,.05)' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{s.label}</p>
                      <p className="font-display text-2xl leading-none" style={{ color: '#0D2B5E' }}>{s.value}</p>
                      <p className="text-xs text-slate-400 mt-1.5">{s.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 flex-wrap mb-5 fade-up-2">
                  <PdfExportButton params={params} result={result} config={config} />
                  <button onClick={() => setEmailOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 border-2"
                    style={{ color: '#1565C0', borderColor: '#1565C0' }}>
                    ✉️ Enviar por email
                  </button>
                  <button onClick={() => { changeTab('clients'); showToast('👤', 'Completa los datos del cliente') }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-slate-200 bg-slate-100 text-slate-700">
                    👤 Guardar como cliente
                  </button>
                </div>
                <div className="fade-up-2">
                  <button onClick={() => setShowTable(s => !s)}
                    className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all mb-4"
                    style={{ background: showTable ? '#0D2B5E' : '#e8eef7', color: showTable ? '#fff' : '#0D2B5E', border: `1px solid ${showTable ? '#0D2B5E' : '#c5d5ea'}` }}>
                    {showTable ? '▲ Ocultar cronograma' : '▼ Ver cronograma semanal'}
                  </button>
                  {showTable && (
                    <div className={card} style={cardShadow}>
                      {sectionTitle(`Cronograma semanal — ${weeklyResult.totalWeeks} cuotas`)}
                      <PaymentScheduleTable rows={weeklySchedule} accentColor="#1565C0" currency={currency} periodLabel="Semana" />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Results — Carrito ── */}
            {loanType === 'carrito' && (
              <>
                <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3 fade-up-1"
                  style={{ background: '#FFF8E1', border: '1.5px solid #F59E0B44' }}>
                  <span className="text-2xl">🛒</span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: '#F59E0B' }}>Carrito — Tasa plana</p>
                    <p className="font-display text-xl" style={{ color: '#6D4C00' }}>
                      {formatPercent(carritoFlatRate)} × {carritoTerm} períodos
                    </p>
                  </div>
                  <div className="text-right ml-auto">
                    <p className="text-xs text-slate-500 mb-0.5">Interés total</p>
                    <p className="text-xl font-bold" style={{ color: '#F59E0B' }}>{fmt(carritoResult.totalInterest)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 fade-up-1">
                  {[
                    { label: 'Cuota fija',      value: fmt(carritoResult.fixedPayment),   sub: `× ${carritoResult.numPayments} cuotas` },
                    { label: 'Total a pagar',   value: fmt(carritoResult.totalPayment),   sub: 'Capital + interés plano' },
                    { label: 'Total intereses', value: fmt(carritoResult.totalInterest),  sub: `${formatPercent(carritoResult.interestRatio)} del capital` },
                    { label: 'Frecuencia',      value: carritoFreq === 'daily' ? 'Diario' : 'Semanal', sub: `${carritoPayments} pagos` },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-4 border border-slate-200 bg-white" style={{ boxShadow: '0 1px 6px rgba(0,0,0,.05)' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{s.label}</p>
                      <p className="font-display text-2xl leading-none" style={{ color: '#0D2B5E' }}>{s.value}</p>
                      <p className="text-xs text-slate-400 mt-1.5">{s.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 flex-wrap mb-5 fade-up-2">
                  <PdfExportButton params={params} result={result} config={config} />
                  <button onClick={() => setEmailOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 border-2"
                    style={{ color: '#1565C0', borderColor: '#1565C0' }}>
                    ✉️ Enviar por email
                  </button>
                  <button onClick={() => { changeTab('clients'); showToast('👤', 'Completa los datos del cliente') }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-slate-200 bg-slate-100 text-slate-700">
                    👤 Guardar como cliente
                  </button>
                </div>
                <div className="fade-up-2">
                  <button onClick={() => setShowTable(s => !s)}
                    className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all mb-4"
                    style={{ background: showTable ? '#0D2B5E' : '#e8eef7', color: showTable ? '#fff' : '#0D2B5E', border: `1px solid ${showTable ? '#0D2B5E' : '#c5d5ea'}` }}>
                    {showTable ? '▲ Ocultar cronograma' : '▼ Ver cronograma de pagos'}
                  </button>
                  {showTable && (
                    <div className={card} style={cardShadow}>
                      {sectionTitle(`Cronograma de pagos — ${carritoResult.numPayments} cuotas ${carritoFreq === 'daily' ? 'diarias' : 'semanales'}`)}
                      <PaymentScheduleTable rows={carritoSchedule} accentColor="#F59E0B" currency={currency} periodLabel={carritoFreq === 'daily' ? 'Día' : 'Semana'} />
                    </div>
                  )}
                </div>
              </>
            )}
            </>}

            {/* ── Multi-préstamo sub-tab ── */}
            {calcSubTab === 'multiloan' && (
              <div className={card} style={cardShadow}>
                {sectionTitle('Comparación de hasta 4 préstamos')}
                <MultiLoanPanel currency={currency} />
              </div>
            )}

            {/* ── Comparación sub-tab ── */}
            {calcSubTab === 'comparison' && (
              <>
                <div className="rounded-2xl p-5 bg-white border border-slate-200 mb-5 flex items-center gap-5 flex-wrap" style={cardShadow}>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full" style={{ background: '#1565C0' }} />
                    <span className="text-sm font-semibold" style={{ color: '#0D2B5E' }}>Préstamo base:</span>
                  </div>
                  <div className="flex gap-6">
                    <div><p className="text-xs text-slate-400">Monto</p><p className="font-display text-xl" style={{ color: '#0D2B5E' }}>{fmt(amount)}</p></div>
                    <div><p className="text-xs text-slate-400">Plazo</p><p className="font-display text-xl" style={{ color: '#0D2B5E' }}>{termUnit === 'months' ? `${termValue} meses` : `${termValue} años`}</p></div>
                  </div>
                  <p className="text-xs text-slate-400 ml-auto">Ajustá los parámetros en Simulación</p>
                </div>
                <div className={card} style={cardShadow}>
                  {sectionTitle('Comparación de perfiles de riesgo')}
                  <ComparisonPanel amount={amount} termYears={termYears} currency={currency} />
                </div>
              </>
            )}
          </>
        )}

        {/* ═══ DASHBOARD ═══ */}
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

        {/* ═══ BRANCHES ═══ */}
        {tab === 'branches' && (
          <BranchesPanel
            onViewProfile={(id) => {
              setSelectedClientId(id)
              changeTab('clients')
            }}
          />
        )}

      </main>

      {/* Footer — hidden on mobile (bottom nav takes the space) */}
      <footer className="hidden sm:block bg-white border-t border-slate-200 text-center py-5 text-xs text-slate-400 mt-4">
        <strong style={{ color: '#0D2B5E' }}>LendStack</strong> · Herramienta de análisis financiero ·
        Los cálculos son referenciales y no constituyen asesoramiento financiero.
      </footer>

      {/* ── Mobile quick-pay FAB (above bottom nav) ── */}
      <button
        className="sm:hidden fixed z-50 w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-2xl transition-all active:scale-95"
        style={{ bottom: '88px', right: '20px', background: 'linear-gradient(135deg,#1565C0,#0D2B5E)', boxShadow: '0 4px 16px rgba(21,101,192,.5)' }}
        onClick={() => setShowPayment(true)}
        title="Registrar pago de cuota">
        +
      </button>

      {/* ── Mobile bottom tab bar (below sm) ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 pb-safe"
        style={{ boxShadow: '0 -2px 16px rgba(0,0,0,.1)' }}>
        <div className="flex">
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button key={t.id}
                onClick={() => { changeTab(t.id); if (t.id !== 'clients') setSelectedClientId(null); if (t.id !== 'loans') setSelectedLoanId(null) }}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all"
                style={{ color: active ? '#1565C0' : '#94a3b8' }}>
                <span className="text-2xl leading-none">{t.emoji}</span>
                <span className="text-[10px] font-bold tracking-wide">{t.mobileLabel}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: '#1565C0' }} />
                )}
              </button>
            )
          })}
        </div>
      </nav>

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
