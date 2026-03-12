'use client'

export default function MobileActionBar({
  onSearch,
  onNewLoan,
  onQuickPayment,
  onReports,
}: {
  onSearch: () => void
  onNewLoan: () => void
  onQuickPayment: () => void
  onReports: () => void
}) {
  return (
    <div className="sm:hidden sticky top-[76px] z-30 bg-slate-50/95 backdrop-blur px-3 pt-2 pb-3 border-b border-slate-200">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onSearch} className="min-h-11 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700">🔎 Buscar cliente</button>
        <button onClick={onNewLoan} className="min-h-11 rounded-xl text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#1565C0,#0D2B5E)' }}>+ Nuevo préstamo</button>
        <button onClick={onQuickPayment} className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 text-xs font-semibold" style={{ color: '#0D2B5E' }}>💵 Registrar pago</button>
        <button onClick={onReports} className="min-h-11 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700">📑 Ver reportes</button>
      </div>
    </div>
  )
}
