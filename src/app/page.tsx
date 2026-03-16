import Link          from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import LendStackLogo        from '@/components/LendStackLogo'

// ─── Icons (inline SVGs — no extra deps) ──────────────────────────────────────
const IconCalc = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/>
    <line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/>
  </svg>
)
const IconBell = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)
const IconUsers = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IconCreditCard = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
)
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

// ─── Pricing tier data ─────────────────────────────────────────────────────────
const PLANS = [
  {
    name: 'Starter',
    price: '$99',
    desc: 'Para prestamistas que están empezando',
    features: ['Hasta 50 préstamos activos', 'Calculadora PMT completa', 'Gestión de clientes', 'Documentos en la nube', 'Recordatorios por email'],
    cta: 'Empezar gratis',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$299',
    desc: 'Para financieras en crecimiento',
    features: ['Hasta 500 préstamos activos', 'Todo lo de Starter', 'Múltiples usuarios', 'Dashboard con KPIs', 'Reportes avanzados', 'Soporte prioritario'],
    cta: 'Elegir Pro',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '$799',
    desc: 'Para instituciones y cooperativas',
    features: ['Préstamos ilimitados', 'Todo lo de Pro', 'API de integración', 'SLA garantizado', 'Onboarding dedicado', 'Facturación personalizada'],
    cta: 'Contactar ventas',
    highlight: false,
  },
]

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <IconCalc />,
    title: 'Calculadora PMT',
    desc: 'Simulá cualquier préstamo en segundos. Tabla de amortización completa, comparación de perfiles de riesgo y exportación a PDF.',
  },
  {
    icon: <IconCreditCard />,
    title: 'Seguimiento de pagos',
    desc: 'Registrá cuotas pagadas, detectá morosos automáticamente y llevá el historial completo de cada préstamo en tiempo real.',
  },
  {
    icon: <IconBell />,
    title: 'Recordatorios automáticos',
    desc: 'El sistema avisa a tus clientes 3 días antes del vencimiento y te alerta a vos cuando hay una cuota impaga.',
  },
  {
    icon: <IconUsers />,
    title: 'Gestión de clientes',
    desc: 'Expediente digital con datos personales, historial crediticio, garantías y documentos firmados almacenados en la nube.',
  },
]

// ─── Steps ────────────────────────────────────────────────────────────────────
const STEPS = [
  { num: '01', title: 'Creá tu cuenta', desc: 'Registrá tu empresa en minutos. Sin tarjeta de crédito para empezar.' },
  { num: '02', title: 'Cargá tus clientes', desc: 'Importá tu cartera o ingresá clientes nuevos con el formulario guiado.' },
  { num: '03', title: 'Emití y cobrá', desc: 'Generá préstamos, enviá propuestas por email y registrá pagos desde el panel.' },
]

// ─── Landing page ─────────────────────────────────────────────────────────────
export default async function LandingPage() {
  const session   = await getServerSession(authOptions)
  const loggedIn  = !!session

  const grad  = 'linear-gradient(135deg, #071a3e 0%, #0D2B5E 55%, #1565C0 100%)'
  const glass = { background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', backdropFilter: 'blur(8px)' }

  return (
    <div style={{ background: '#071a3e', minHeight: '100vh', color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Grid overlay ─────────────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none" style={{ opacity: 0.04, backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '38px 38px' }} />

      {/* ═══════════════ NAV ═══════════════════════════════════════════════════ */}
      <nav className="relative z-50 sticky top-0" style={{ background: 'rgba(7,26,62,.85)', borderBottom: '1px solid rgba(255,255,255,.08)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href={loggedIn ? '/app' : '/'} className="flex items-center">
            <LendStackLogo variant="light" size={38} />
          </Link>

          {/* Nav links (desktop) */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium transition-opacity hover:opacity-80" style={{ color: '#9eb8da' }}>Características</a>
            <a href="#how"      className="text-sm font-medium transition-opacity hover:opacity-80" style={{ color: '#9eb8da' }}>Cómo funciona</a>
            <a href="#pricing"  className="text-sm font-medium transition-opacity hover:opacity-80" style={{ color: '#9eb8da' }}>Precios</a>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2">
            {loggedIn ? (
              <Link href="/app"
                className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1565C0, #0D2B5E)' }}>
                Ir al panel →
              </Link>
            ) : (
              <>
                <Link href="/login"
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                  style={{ color: '#c5d5ea' }}>
                  Iniciar sesión
                </Link>
                <Link href="/register"
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #1565C0, #0D2B5E)', border: '1px solid rgba(255,255,255,.2)' }}>
                  Empezar gratis
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══════════════ HERO ══════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-24 px-6" style={{ background: grad }}>
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
            style={{ background: 'rgba(21,101,192,.35)', border: '1px solid rgba(21,101,192,.6)', color: '#90caf9' }}>
            ✦ Plataforma de préstamos para LATAM
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6" style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.02em' }}>
            Gestioná tus préstamos<br />
            <span style={{ background: 'linear-gradient(90deg, #64b5f6, #90caf9, #42a5f5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              con claridad total
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg leading-relaxed max-w-2xl mx-auto mb-10" style={{ color: '#9eb8da' }}>
            LendStack centraliza clientes, cuotas y cobranza en un solo lugar.
            Calculadora PMT profesional, seguimiento de pagos y recordatorios
            automáticos para prestamistas modernos.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <Link href={loggedIn ? '/app' : '/register'}
              className="px-8 py-3.5 rounded-2xl text-base font-bold text-white transition-all hover:opacity-90 hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #1565C0, #1976D2)', boxShadow: '0 4px 24px rgba(21,101,192,.5)' }}>
              {loggedIn ? 'Ir al panel' : 'Empezar gratis — 14 días sin costo'}
            </Link>
            <Link href="/login"
              className="px-8 py-3.5 rounded-2xl text-base font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.2)', color: '#c5d5ea' }}>
              Ver demo
            </Link>
          </div>

          {/* Mock UI card */}
          <div className="max-w-2xl mx-auto rounded-2xl overflow-hidden" style={{ ...glass, boxShadow: '0 24px 80px rgba(0,0,0,.5)' }}>
            {/* Card header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)' }}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400 opacity-80" />
                <div className="w-3 h-3 rounded-full bg-yellow-400 opacity-80" />
                <div className="w-3 h-3 rounded-full bg-green-400 opacity-80" />
              </div>
              <span className="text-xs font-mono" style={{ color: '#6d96c8' }}>LendStack — Panel de préstamos</span>
              <div />
            </div>
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-px" style={{ background: 'rgba(255,255,255,.06)' }}>
              {[
                { label: 'Préstamos activos', value: '24', sub: '+3 este mes' },
                { label: 'Cartera total',     value: '$284,000', sub: 'USD' },
                { label: 'Tasa de cobro',     value: '96.4%', sub: '↑ vs mes anterior' },
              ].map(k => (
                <div key={k.label} className="px-5 py-4" style={{ background: 'rgba(7,26,62,.6)' }}>
                  <p className="text-xs mb-1" style={{ color: '#6d96c8' }}>{k.label}</p>
                  <p className="text-xl font-bold text-white">{k.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#42a5f5' }}>{k.sub}</p>
                </div>
              ))}
            </div>
            {/* Fake table rows */}
            <div className="px-6 py-2" style={{ background: 'rgba(7,26,62,.4)' }}>
              {[
                { name: 'Martínez, Carlos',  amount: '$15,000', status: 'Al día',  color: '#4caf50' },
                { name: 'López, Ana',        amount: '$8,500',  status: 'Vence hoy', color: '#ff9800' },
                { name: 'Rodríguez, Miguel', amount: '$22,000', status: 'Al día',  color: '#4caf50' },
              ].map(r => (
                <div key={r.name} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <span className="text-sm font-medium" style={{ color: '#c5d5ea' }}>{r.name}</span>
                  <span className="text-sm font-mono" style={{ color: '#90caf9' }}>{r.amount}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: r.color + '22', color: r.color }}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES ══════════════════════════════════════════════ */}
      <section id="features" className="py-24 px-6" style={{ background: '#071a3e' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#1565C0' }}>Características</p>
            <h2 className="text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>Todo lo que necesitás para prestar</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-2xl p-7 transition-all hover:scale-[1.01]" style={glass}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: 'rgba(21,101,192,.25)', color: '#64b5f6' }}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#9eb8da' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ══════════════════════════════════════════ */}
      <section id="how" className="py-24 px-6" style={{ background: 'linear-gradient(180deg, #071a3e, #0D2B5E)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#1565C0' }}>Cómo funciona</p>
            <h2 className="text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>En marcha en menos de 5 minutos</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.num} className="text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ background: i === 1 ? 'rgba(21,101,192,.5)' : 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)' }}>
                  <span className="text-2xl font-bold" style={{ color: i === 1 ? '#90caf9' : '#6d96c8' }}>{s.num}</span>
                </div>
                <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-sm" style={{ color: '#9eb8da' }}>{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block absolute" style={{ top: '2rem', right: '-1rem' }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ PRICING ═══════════════════════════════════════════════ */}
      <section id="pricing" className="py-24 px-6" style={{ background: '#071a3e' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#1565C0' }}>Precios</p>
            <h2 className="text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>Sin costos ocultos</h2>
            <p className="text-sm mt-3" style={{ color: '#9eb8da' }}>14 días de prueba gratuita en todos los planes · Sin tarjeta de crédito</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {PLANS.map(plan => (
              <div key={plan.name} className="rounded-2xl p-7 flex flex-col relative"
                style={plan.highlight
                  ? { background: 'linear-gradient(145deg, #1565C0, #0D2B5E)', border: '1px solid rgba(100,181,246,.4)', boxShadow: '0 8px 48px rgba(21,101,192,.4)' }
                  : glass}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold"
                    style={{ background: '#42a5f5', color: '#071a3e' }}>
                    Más popular
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-xs mb-4" style={{ color: plan.highlight ? '#90caf9' : '#9eb8da' }}>{plan.desc}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span style={{ color: plan.highlight ? '#90caf9' : '#6d96c8' }}>/mes</span>
                  </div>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-0.5 flex-shrink-0" style={{ color: '#42a5f5' }}><IconCheck /></span>
                      <span style={{ color: plan.highlight ? '#e3f2fd' : '#c5d5ea' }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register"
                  className="block text-center py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                  style={plan.highlight
                    ? { background: '#fff', color: '#0D2B5E' }
                    : { background: 'rgba(21,101,192,.3)', color: '#90caf9', border: '1px solid rgba(21,101,192,.5)' }}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FINAL CTA ════════════════════════════════════════════ */}
      <section className="py-24 px-6" style={{ background: 'linear-gradient(135deg, #0D2B5E, #1565C0)' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4" style={{ letterSpacing: '-0.02em' }}>
            Empezá hoy sin riesgo
          </h2>
          <p className="text-lg mb-10" style={{ color: '#c5d5ea' }}>
            14 días gratis, sin tarjeta de crédito. Cancelás cuando quieras.
          </p>
          <Link href="/register"
            className="inline-block px-10 py-4 rounded-2xl text-base font-bold text-white transition-all hover:opacity-90 hover:scale-105"
            style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.35)', boxShadow: '0 4px 24px rgba(0,0,0,.3)' }}>
            Crear cuenta gratis →
          </Link>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════════════════════════════════════ */}
      <footer className="py-8 px-6 text-center text-sm" style={{ background: '#040f22', borderTop: '1px solid rgba(255,255,255,.06)', color: '#4a6a8a' }}>
        <div className="flex flex-wrap justify-center gap-6 mb-4">
          <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
          <Link href="/login"  className="hover:text-white transition-colors">Iniciar sesión</Link>
          <Link href="/register" className="hover:text-white transition-colors">Registrarse</Link>
        </div>
        <p>
          <strong style={{ color: '#6d96c8' }}>LendStack</strong> · Plataforma de gestión de préstamos para LATAM · © {new Date().getFullYear()}
        </p>
      </footer>

    </div>
  )
}
