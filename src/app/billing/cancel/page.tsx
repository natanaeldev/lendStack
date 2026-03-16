import Link from 'next/link'

export default function BillingCancelPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-20 text-white">
      <div className="mx-auto max-w-xl rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_rgba(0,0,0,.35)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">Facturación</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.03em]">Checkout cancelado</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          La organización quedó creada y sigue operando en su estado actual. Puedes volver a intentar el upgrade cuando quieras.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-bold text-slate-950">
            Iniciar sesión
          </Link>
          <Link href="/register?resume=1" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 px-5 text-sm font-semibold text-white">
            Reintentar registro
          </Link>
        </div>
      </div>
    </main>
  )
}
