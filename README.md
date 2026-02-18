# JVF Inversiones SRL — Calculadora de Préstamos Pro

Aplicación Next.js para análisis de préstamos con perfiles de riesgo.

## 🚀 Inicio rápido

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## ✨ Funciones

| Función              | Descripción                                                    |
|----------------------|----------------------------------------------------------------|
| 🧮 Calculadora       | PMT, amortización, gráficos, tabla paginada                    |
| 💱 Multi-divisa      | USD · ARS · EUR con toggle instantáneo                         |
| 📄 Exportar PDF      | Genera un PDF completo listo para imprimir o guardar           |
| ✉️ Email             | Envía cotización por email (requiere configurar Resend abajo)  |
| 📋 Multi-préstamo    | Compara hasta 4 préstamos distintos side-by-side               |
| 📊 Comparación       | 3 perfiles de riesgo para el mismo monto                       |
| 👥 Clientes          | Guarda simulaciones con datos del cliente (localStorage)       |

## 📧 Configurar email real (Resend)

1. Crea una cuenta en [resend.com](https://resend.com) (plan gratuito disponible)
2. Obtén tu API key
3. Crea `.env.local` en la raíz del proyecto:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
   ```
4. En `src/app/api/send-email/route.ts`, descomenta el bloque de Resend

## 🎨 Perfiles de riesgo

| Perfil      | Rango      | Mid (usado en cálculo) |
|-------------|-----------|------------------------|
| 🟢 Low Risk  | 5% – 7%   | 6%                     |
| 🟡 Medium Risk | 8% – 10% | 9%                    |
| 🔴 High Risk | 13% – 15% | 14%                    |

## 🏗️ Estructura del proyecto

```
src/
├── app/
│   ├── api/send-email/route.ts   # Email API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # Main page (tab orchestrator)
├── components/
│   ├── Header.tsx
│   ├── CurrencyToggle.tsx        # USD / ARS / EUR switcher
│   ├── RiskSelector.tsx
│   ├── ResultsPanel.tsx
│   ├── AmortizationChart.tsx     # Recharts area + bar chart
│   ├── AmortizationTable.tsx     # Paginated table
│   ├── ComparisonPanel.tsx       # 3-profile comparison
│   ├── MultiLoanPanel.tsx        # Up to 4 loans
│   ├── ClientsPanel.tsx          # Client management (localStorage)
│   ├── PdfExport.tsx             # Browser print PDF
│   ├── EmailModal.tsx            # Email quote modal
│   └── Toast.tsx                 # Toast notifications
└── lib/
    └── loan.ts                   # All calculations & types
```

## 🔧 Variables de entorno

```env
RESEND_API_KEY=re_xxxxxxx        # Para email real
NEXT_PUBLIC_CURRENCY_API_KEY=    # Opcional: API de tipo de cambio en vivo
```
