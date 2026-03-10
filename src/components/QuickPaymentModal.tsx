'use client'
import { useState, useEffect, useRef } from 'react'
import { formatCurrency } from '@/lib/loan'
import { PaymentReceiptModal } from '@/components/PaymentReceipt'
import type { ReceiptData } from '@/components/PaymentReceipt'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientOption {
  id: string
  name: string
  currency: string
  loanAmount: number
  monthlyPayment: number
  totalPayment: number
  totalMonths: number
  loanStatus: string
  paidTotal: number
}

interface Props {
  isOpen:  boolean
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuickPaymentModal({ isOpen, onClose }: Props) {
  const [clients,    setClients]    = useState<ClientOption[]>([])
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState<ClientOption | null>(null)
  const [amount,     setAmount]     = useState('')
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10))
  const [cuotaNum,   setCuotaNum]   = useState('')
  const [notes,      setNotes]      = useState('')
  const [submitting,          setSubmitting]          = useState(false)
  const [success,             setSuccess]             = useState(false)
  const [error,               setError]               = useState('')
  const [receiptData,         setReceiptData]         = useState<ReceiptData | null>(null)
  const [comprobanteFile,     setComprobanteFile]     = useState<File | null>(null)
  const [comprobantePreview,  setComprobantePreview]  = useState<string | null>(null)
  const amountRef      = useRef<HTMLInputElement>(null)
  const comprobanteRef = useRef<HTMLInputElement>(null)

  // Fetch clients when modal opens
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setSuccess(false)
    setError('')
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => {
        const list: ClientOption[] = (data.clients ?? []).map((c: any) => ({
          id:             c.id,
          name:           c.name,
          currency:       c.params?.currency ?? 'USD',
          loanAmount:     c.params?.amount ?? 0,
          monthlyPayment: c.result?.monthlyPayment ?? 0,
          totalPayment:   c.result?.totalPayment ?? 0,
          totalMonths:    c.result?.totalMonths ?? 0,
          loanStatus:     c.loanStatus ?? 'pending',
          paidTotal:      (c.payments ?? []).reduce((s: number, p: any) => s + p.amount, 0),
        }))
        setClients(list)
      })
      .catch(() => setError('No se pudo cargar la lista de clientes.'))
      .finally(() => setLoading(false))
  }, [isOpen])

  // Pre-fill amount when client selected
  useEffect(() => {
    if (selected) {
      setAmount(selected.monthlyPayment.toFixed(2))
      setCuotaNum('')
      setTimeout(() => amountRef.current?.select(), 50)
    }
  }, [selected])

  // Reset all state on close
  const handleClose = () => {
    setSearch('')
    setSelected(null)
    setAmount('')
    setDate(new Date().toISOString().slice(0, 10))
    setCuotaNum('')
    setNotes('')
    setComprobanteFile(null)
    setComprobantePreview(null)
    setSuccess(false)
    setError('')
    onClose()
  }

  const handleComprobanteChange = (file: File) => {
    setComprobanteFile(file)
    const reader = new FileReader()
    reader.onload = ev => setComprobantePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const clearComprobante = () => {
    setComprobanteFile(null)
    setComprobantePreview(null)
    if (comprobanteRef.current) comprobanteRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!selected) return
    const amt = parseFloat(amount)
    if (!date || isNaN(amt) || amt <= 0) {
      setError('Completá la fecha y un monto válido.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      // Use FormData so we can attach the comprobante image
      const fd = new FormData()
      fd.append('date',   date)
      fd.append('amount', String(amt))
      if (cuotaNum)     fd.append('cuotaNumber', cuotaNum)
      if (notes.trim()) fd.append('notes',       notes.trim())
      if (comprobanteFile) fd.append('comprobante', comprobanteFile)

      const res = await fetch(`/api/clients/${selected.id}/payments`, {
        method: 'POST',
        body:   fd,   // browser sets Content-Type with boundary automatically
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Error al registrar el pago.')
        return
      }
      const { payment } = await res.json()
      setSuccess(true)
      // Show receipt modal (rendered at z-60, above this modal's z-50)
      setReceiptData({
        clientName:     selected.name,
        clientIdType:   '',
        clientId:       '',
        clientEmail:    '',
        paymentId:      payment.id,
        date:           payment.date,
        amount:         payment.amount,
        cuotaNumber:    payment.cuotaNumber,
        notes:          payment.notes,
        currency:       selected.currency,
        loanAmount:     selected.loanAmount,
        monthlyPayment: selected.monthlyPayment,
        totalMonths:    selected.totalMonths,
        profile:        '',
      })
      // Reset for next payment after a moment
      setTimeout(() => {
        setSelected(null)
        setSearch('')
        setAmount('')
        setCuotaNum('')
        setNotes('')
        setDate(new Date().toISOString().slice(0, 10))
        setComprobanteFile(null)
        setComprobantePreview(null)
        setSuccess(false)
      }, 1800)
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  if (!isOpen) return null

  const fmt = (v: number, cur: string) => formatCurrency(v, cur as any)

  // Receipt modal renders on top of this modal (z-60 > z-50)
  if (receiptData) return (
    <PaymentReceiptModal
      data={receiptData}
      onClose={() => setReceiptData(null)}
      zIndex={60}
    />
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(7,26,62,.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}>

      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#fff', boxShadow: '0 24px 80px rgba(7,26,62,.35)' }}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg,#071a3e,#1565C0)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-black"
              style={{ background: 'rgba(255,255,255,.15)' }}>
              💵
            </div>
            <div>
              <p className="text-white font-bold text-sm">Registrar pago de cuota</p>
              <p className="text-blue-200 text-xs">Seleccioná el cliente y el monto</p>
            </div>
          </div>
          <button onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}>
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Success state */}
          {success && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: '#f0fdf4', border: '2px solid #86efac' }}>
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-sm font-bold text-green-800">¡Pago registrado!</p>
                <p className="text-xs text-green-600">El pago fue guardado correctamente.</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-2.5 rounded-xl text-sm"
              style={{ background: '#fff1f2', color: '#be123c', border: '1.5px solid #fecdd3' }}>
              {error}
            </div>
          )}

          {/* Client selector */}
          {!selected ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Seleccionar cliente
              </label>
              <input
                autoFocus
                type="text"
                placeholder="Buscar por nombre…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white mb-2"
                style={{ color: '#374151' }}
              />
              {loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                  <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mr-2" />
                  Cargando clientes…
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center py-6 text-sm text-slate-400">
                  {clients.length === 0 ? 'No hay clientes registrados.' : 'Sin resultados.'}
                </p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                  {filtered.map(c => {
                    const progress = Math.min(100, Math.round((c.paidTotal / c.totalPayment) * 100))
                    return (
                      <button key={c.id}
                        onClick={() => setSelected(c)}
                        className="w-full text-left px-4 py-3 rounded-xl border-2 border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-all">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-800 truncate">{c.name}</span>
                          <span className="text-xs font-semibold flex-shrink-0 px-2 py-0.5 rounded-full"
                            style={{
                              background: c.loanStatus === 'approved' ? '#f0fdf4' : c.loanStatus === 'denied' ? '#fff1f2' : '#fffbeb',
                              color:      c.loanStatus === 'approved' ? '#15803d' : c.loanStatus === 'denied' ? '#dc2626' : '#92400e',
                            }}>
                            {c.loanStatus === 'approved' ? '✅' : c.loanStatus === 'denied' ? '❌' : '⏳'}{' '}
                            {c.loanStatus === 'approved' ? 'Aprobado' : c.loanStatus === 'denied' ? 'Denegado' : 'Pendiente'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full"
                              style={{ width: `${progress}%`, background: progress >= 100 ? '#16a34a' : 'linear-gradient(90deg,#1565C0,#0D2B5E)' }} />
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0">{progress}%</span>
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            {fmt(c.monthlyPayment, c.currency)}/mes
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">

              {/* Selected client pill */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: '#e8eef7', border: '2px solid #c5d5ea' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Cliente seleccionado</p>
                  <p className="text-sm font-bold truncate" style={{ color: '#0D2B5E' }}>{selected.name}</p>
                </div>
                <button onClick={() => { setSelected(null); setSearch('') }}
                  className="text-xs text-slate-400 hover:text-slate-600 underline flex-shrink-0 transition-colors">
                  Cambiar
                </button>
              </div>

              {/* Loan info */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Cuota mensual', value: fmt(selected.monthlyPayment, selected.currency) },
                  { label: 'Total préstamo', value: fmt(selected.totalPayment, selected.currency) },
                  { label: 'Cuotas totales', value: `${selected.totalMonths}` },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center px-2 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
                    <p className="text-xs font-black" style={{ color: '#0D2B5E' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Fecha *</label>
                  <input type="date" value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full max-w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
                    style={{ color: '#374151' }} />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Monto *</label>
                  <input ref={amountRef} type="number" min="0" step="0.01" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
                    style={{ color: '#374151' }} />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">N.º de cuota</label>
                  <input type="number" min="1" max={selected.totalMonths} value={cuotaNum}
                    onChange={e => setCuotaNum(e.target.value)}
                    placeholder={`1 – ${selected.totalMonths}`}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
                    style={{ color: '#374151' }} />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Notas</label>
                  <input type="text" value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Ej: efectivo…"
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-white"
                    style={{ color: '#374151' }} />
                </div>
              </div>

              {/* Comprobante (receipt photo) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  📸 Comprobante (opcional)
                </label>
                {comprobantePreview ? (
                  <div className="relative rounded-xl overflow-hidden border-2 border-blue-200 bg-slate-50">
                    <img
                      src={comprobantePreview}
                      alt="Comprobante"
                      className="w-full max-h-44 object-contain"
                    />
                    <button
                      onClick={clearComprobante}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-opacity hover:opacity-90"
                      style={{ background: '#DC2626' }}
                      title="Quitar imagen">
                      ✕
                    </button>
                    <div className="px-3 py-1.5 text-xs text-slate-400 border-t border-slate-100 truncate">
                      {comprobanteFile?.name}
                    </div>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                    <input
                      ref={comprobanteRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) handleComprobanteChange(f)
                        e.target.value = ''
                      }}
                    />
                    <span className="text-2xl flex-shrink-0">📸</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-600 leading-tight">Adjuntar comprobante</p>
                      <p className="text-xs text-slate-400 mt-0.5">Usá la cámara o elegí una imagen</p>
                    </div>
                  </label>
                )}
              </div>

              {/* Submit */}
              <button onClick={handleSubmit} disabled={submitting || success}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#0D2B5E,#1565C0)' }}>
                {submitting ? '⏳ Registrando…' : success ? '✅ ¡Registrado!' : '💵 Confirmar pago'}
              </button>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
