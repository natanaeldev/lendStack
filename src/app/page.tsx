'use client'

import { useState, useCallback } from 'react'
import Header from '@/components/Header'
import CurrencyToggle from '@/components/CurrencyToggle'
import RateModeToggle from '@/components/RateModeToggle'
import RiskSelector from '@/components/RiskSelector'
import ResultsPanel from '@/components/ResultsPanel'
import AmortizationChart from '@/components/AmortizationChart'
import AmortizationTable from '@/components/AmortizationTable'
import ComparisonPanel from '@/components/ComparisonPanel'
import MultiLoanPanel from '@/components/MultiLoanPanel'
import ClientsPanel from '@/components/ClientsPanel'
import PdfExportButton from '@/components/PdfExport'
import EmailModal from '@/components/EmailModal'
import ToastProvider, { showToast } from '@/components/Toast'
import {
  calculateLoan, buildAmortization, getRiskConfig,
  RiskProfile, Currency, RateMode, LoanParams,
  formatCurrency,
} from '@/lib/loan'

type Tab = 'calculator' | 'multiloan' | 'comparison' | 'clients'

const TABS: { id: Tab; label: string }[] = [
  { id: 'calculator',  label: '🧮 Calculadora'          },
  { id: 'multiloan',   label: '📋 Multi-préstamo'        },
  { id: 'comparison',  label: '📊 Comparación'           },
  { id: 'clients',     label: '👥 Clientes'              },
]

export default function Home() {
  const [tab,               setTab]               = useState<Tab>('calculator')
  const [amount,            setAmount]            = useState(100000)
  const [termUnit,          setTermUnit]          = useState<'years' | 'months'>('years')
  const [termValue,         setTermValue]         = useState(5)          // in the selected unit
  const [profile,           setProfile]           = useState<RiskProfile>('Medium Risk')
  const [currency,          setCurrency]          = useState<Currency>('USD')
  const [rateMode,          setRateMode]          = useState<RateMode>('annual')
  const [customMonthlyRate, setCustomMonthlyRate] = useState(0.015)
  const [showTable,         setShowTable]         = useState(false)
  const [emailOpen,         setEmailOpen]         = useState(false)

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

  const handleLoadClient = useCallback((p: LoanParams) => {
    setAmount(p.amount)
    setTermUnit('years')           // clients always saved with termYears in years
    setTermValue(p.termYears)
    setProfile(p.profile)
    setCurrency(p.currency)
    setTab('calculator')
    showToast('📂', 'Simulación de cliente cargada')
  }, [])

  const handleCurrencyChange = (c: Currency) => {
    setCurrency(c)
    showToast('💱', `Moneda cambiada a ${c}`)
  }

  const handleRateModeChange = (m: RateMode) => {
    setRateMode(m)
    showToast(m === 'monthly' ? '🗓️' : '📅', m === 'monthly' ? 'Modo tasa mensual activado' : 'Modo tasa anual activado')
  }

  const card = 'rounded-2xl p-6 bg-white border border-slate-200 mb-5'
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

      {/* Tab bar */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200" style={{ boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
        <div className="max-w-6xl mx-auto px-6 flex overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-5 py-3.5 text-xs sm:text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0"
              style={{ borderBottomColor: tab === t.id ? '#1565C0' : 'transparent', color: tab === t.id ? '#1565C0' : '#64748b', background: 'transparent', fontFamily: "'DM Sans', sans-serif" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 flex-1">

        {/* ═══ CALCULATOR ═══ */}
        {tab === 'calculator' && (
          <>
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
                      {currency === 'EUR' ? '€' : '$'}
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

              {/* ── Rate mode toggle ── */}
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
                      <span className="text-xs font-semibold" style={{ color: '#1565C0' }}>
                        / mes
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">
                        ≈ <strong style={{ color: '#0D2B5E' }}>{(customMonthlyRate * 12 * 100).toFixed(2)}%</strong> anual equivalente
                      </span>
                    </div>
                    <input
                      type="range" min={0.01} max={20} step={0.01}
                      value={+(customMonthlyRate * 100).toFixed(2)}
                      onChange={e => setCustomMonthlyRate(parseFloat(e.target.value) / 100)}
                      className="w-full mt-3 accent-blue-600" style={{ height: 4 }}
                    />
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
            </div>

            {/* Results */}
            <div className="mb-5 fade-up-1">
              <ResultsPanel result={result} config={config} currency={currency} rateMode={rateMode} />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 flex-wrap mb-5 fade-up-2">
              <PdfExportButton params={params} result={result} config={config} />
              <button onClick={() => setEmailOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 border-2"
                style={{ color: '#1565C0', borderColor: '#1565C0' }}>
                ✉️ Enviar por email
              </button>
              <button onClick={() => { setTab('clients'); showToast('👤', 'Completa los datos del cliente') }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-slate-200 bg-slate-100 text-slate-700">
                👤 Guardar como cliente
              </button>
            </div>

            {/* Charts */}
            <div className={card + ' fade-up-2'} style={cardShadow}>
              {sectionTitle('Evolución del préstamo')}
              <AmortizationChart rows={rows} accentColor={config.colorAccent} currency={currency} />
            </div>

            {/* Amortization table (collapsible) */}
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

        {/* ═══ MULTI-LOAN ═══ */}
        {tab === 'multiloan' && (
          <div className={card} style={cardShadow}>
            {sectionTitle('Comparación de hasta 4 préstamos')}
            <MultiLoanPanel currency={currency} />
          </div>
        )}

        {/* ═══ COMPARISON ═══ */}
        {tab === 'comparison' && (
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
              <p className="text-xs text-slate-400 ml-auto">Ajusta los parámetros en Calculadora</p>
            </div>
            <div className={card} style={cardShadow}>
              {sectionTitle('Comparación de perfiles de riesgo')}
              <ComparisonPanel amount={amount} termYears={termYears} currency={currency} />
            </div>
          </>
        )}

        {/* ═══ CLIENTS ═══ */}
        {tab === 'clients' && (
          <ClientsPanel currentParams={params} currentResult={result} onLoadClient={handleLoadClient} />
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 text-center py-5 text-xs text-slate-400 mt-4">
        <strong style={{ color: '#0D2B5E' }}>JVF Inversiones SRL</strong> · Herramienta de análisis financiero ·
        Los cálculos son referenciales y no constituyen asesoramiento financiero.
      </footer>

      {/* Modals & notifications */}
      <EmailModal isOpen={emailOpen} onClose={() => setEmailOpen(false)} params={params} result={result} config={config} />
      <ToastProvider />
    </div>
  )
}
