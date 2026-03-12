# LendStack — Product & System Redesign Blueprint (Fintech SaaS)

## 1) Product Architecture (Domain + Platform)

### Domain pillars
1. **Portfolio Intelligence**
   - Real-time KPIs, repayment velocity, delinquency and default trends.
2. **Origination & Underwriting**
   - Borrower intake, KYC, risk scoring, loan simulation, approval workflows.
3. **Servicing & Collections**
   - Installments, manual/automated payments, dunning, late fees, receipts.
4. **Governance & Compliance**
   - RBAC, audit logs, data retention, encryption, operational traceability.

### Logical architecture
- **Web App (Next.js 14 App Router)**
  - Server Components for dashboard/report pages.
  - Client Components for interactive tables, command palette, and inline edits.
- **API Layer (NestJS preferred for module boundaries)**
  - Bounded contexts: auth, orgs, borrowers, loans, payments, risk, reporting, automation, audit.
- **Data Layer**
  - PostgreSQL + Prisma.
  - Redis cache for hot dashboards, search suggestions, idempotency, and rate limiting.
- **Async Layer**
  - Queue (BullMQ/SQS) for reminders, status transitions, report generation, webhooks.
- **Integration Layer**
  - Payment gateways, KYC providers, messaging (email/SMS/WhatsApp), accounting sync.

### Multi-tenant model
- `Organization` as first-class tenant.
- Every business table scoped by `organizationId`.
- Tenant-aware query guards + DB indices on `(organizationId, ...)`.

---

## 2) Page Structure (Information Architecture)

## App shell
- `/app` → Dashboard
- `/app/borrowers`
- `/app/loans`
- `/app/payments`
- `/app/risk`
- `/app/automation`
- `/app/reports`
- `/app/settings/users`
- `/app/settings/audit`

## Key pages and purpose
- **Dashboard**: KPI overview + portfolio performance + activity + quick actions.
- **Borrowers**: CRM-like records, KYC, notes/timeline, risk profile.
- **Loans**: origination, terms, amortization, status lifecycle, collections flags.
- **Payments**: incoming payments, allocation, failures, reconciliation, receipts.
- **Risk**: default analytics, segments, geography, vintage analysis.
- **Automation**: rules engine (reminders, delinquency state changes, escalation).
- **Reports**: downloadable reports + saved views + custom builder.

---

## 3) Component Hierarchy (Frontend)

## Global
- `AppShell`
  - `Topbar` (org switcher, search, command palette trigger, user menu)
  - `SidebarNav` (modules)
  - `CommandPalette`
  - `NotificationCenter`

## Dashboard
- `DashboardPage`
  - `KpiGrid`
    - `KpiCard` (Portfolio Value, Active Loans, Default Rate, MRR)
  - `PortfolioChartPanel`
  - `RepaymentTrendPanel`
  - `RiskDistributionPanel`
  - `ActivityFeed`
  - `QuickActionsBar`

## Borrowers
- `BorrowersPage`
  - `BorrowersToolbar` (search + filters + bulk actions)
  - `BorrowersTable` (virtualized)
  - `BorrowerDrawer`
    - `BorrowerProfileCard`
    - `KycDocumentsPanel`
    - `LoanHistoryTable`
    - `ActivityTimeline`

## Loans
- `LoansPage`
  - `LoansTable`
  - `LoanCreateWizard`
  - `LoanDetailTabs`
    - `LoanTerms`
    - `AmortizationSchedule`
    - `PaymentsLedger`
    - `Collateral`

## Payments
- `PaymentsPage`
  - `UpcomingPaymentsList`
  - `RecordPaymentModal`
  - `PaymentHistoryTable`
  - `ReceiptPreview`

## Risk & Reports
- `RiskPage` → cohort/vintage charts, risk heatmap, delinquency buckets
- `ReportsPage` → templates, exports, generated files history

---

## 4) Database Schema (Prisma-oriented)

```prisma
model Organization {
  id              String   @id @default(cuid())
  name            String
  countryCode     String
  currency        String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  users           User[]
  borrowers       Borrower[]
  loans           Loan[]
  payments        Payment[]
  automationRules AutomationRule[]
  auditLogs       AuditLog[]
}

model User {
  id              String   @id @default(cuid())
  organizationId  String
  email           String   @unique
  fullName        String
  passwordHash    String
  role            UserRole
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())

  organization    Organization @relation(fields: [organizationId], references: [id])
}

enum UserRole {
  ADMIN
  MANAGER
  LOAN_OFFICER
  VIEWER
}

model Borrower {
  id                  String   @id @default(cuid())
  organizationId      String
  externalRef         String?
  fullName            String
  email               String?
  phone               String?
  documentType        String?
  documentNumberEnc   String?
  address             String?
  riskScore           Float?
  riskBand            String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  organization        Organization @relation(fields: [organizationId], references: [id])
  loans               Loan[]
  kycDocuments        KycDocument[]
  notes               BorrowerNote[]
}

model Loan {
  id                  String   @id @default(cuid())
  organizationId      String
  borrowerId          String
  principal           Decimal  @db.Decimal(14,2)
  interestRateAnnual  Decimal  @db.Decimal(8,4)
  termMonths          Int
  lateFeeRate         Decimal? @db.Decimal(8,4)
  status              LoanStatus
  disbursedAt         DateTime?
  closedAt            DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  organization        Organization @relation(fields: [organizationId], references: [id])
  borrower            Borrower @relation(fields: [borrowerId], references: [id])
  installments        Installment[]
  payments            Payment[]
}

enum LoanStatus {
  DRAFT
  PENDING_APPROVAL
  ACTIVE
  DELINQUENT
  DEFAULTED
  CLOSED
  WRITTEN_OFF
}

model Installment {
  id                  String   @id @default(cuid())
  organizationId      String
  loanId              String
  dueDate             DateTime
  principalDue        Decimal  @db.Decimal(14,2)
  interestDue         Decimal  @db.Decimal(14,2)
  feesDue             Decimal  @db.Decimal(14,2)
  amountPaid          Decimal  @db.Decimal(14,2)
  status              InstallmentStatus

  organization        Organization @relation(fields: [organizationId], references: [id])
  loan                Loan @relation(fields: [loanId], references: [id])
}

enum InstallmentStatus {
  UPCOMING
  DUE
  PARTIALLY_PAID
  PAID
  LATE
}

model Payment {
  id                  String   @id @default(cuid())
  organizationId      String
  loanId              String
  borrowerId          String
  amount              Decimal  @db.Decimal(14,2)
  method              PaymentMethod
  providerRef         String?
  paidAt              DateTime
  createdByUserId     String?
  createdAt           DateTime @default(now())

  organization        Organization @relation(fields: [organizationId], references: [id])
  loan                Loan @relation(fields: [loanId], references: [id])
}

enum PaymentMethod {
  CASH
  BANK_TRANSFER
  CARD
  WALLET
}

model KycDocument {
  id                  String   @id @default(cuid())
  organizationId      String
  borrowerId          String
  type                String
  fileUrl             String
  status              String
  createdAt           DateTime @default(now())

  organization        Organization @relation(fields: [organizationId], references: [id])
  borrower            Borrower @relation(fields: [borrowerId], references: [id])
}

model BorrowerNote {
  id                  String   @id @default(cuid())
  organizationId      String
  borrowerId          String
  body                String
  createdByUserId     String
  createdAt           DateTime @default(now())

  organization        Organization @relation(fields: [organizationId], references: [id])
  borrower            Borrower @relation(fields: [borrowerId], references: [id])
}

model AutomationRule {
  id                  String   @id @default(cuid())
  organizationId      String
  name                String
  triggerType         String
  conditionJson       Json
  actionJson          Json
  isActive            Boolean  @default(true)
  createdAt           DateTime @default(now())

  organization        Organization @relation(fields: [organizationId], references: [id])
}

model AuditLog {
  id                  String   @id @default(cuid())
  organizationId      String
  actorUserId         String?
  action              String
  entityType          String
  entityId            String?
  payloadJson         Json?
  ipAddress           String?
  createdAt           DateTime @default(now())

  organization        Organization @relation(fields: [organizationId], references: [id])
}
```

---

## 5) UI Wireframes (Textual)

## Dashboard
- Top row: `KpiCard ×4`
- Middle: Left `Portfolio Value Trend`, right `Repayment vs Expected`
- Bottom: `Activity Feed` + `Quick Actions`
- Sticky controls: date range, branch filter, risk filter, export

## Borrower Detail
- Header: identity + risk badge + contact shortcuts
- Tabs: Profile | KYC | Loans | Timeline
- Right rail: notes + next action (call, send reminder, assign)

## Loan Detail
- Header: status chip + overdue badge + actions
- Tabs: Summary | Schedule | Payments | Documents | Audit
- Footer CTA bar (mobile): Record payment / Send reminder / Add note

---

## 6) Example UI Components

### Command palette actions
- `Create Loan`
- `Add Borrower`
- `Record Payment`
- `Go to Delinquent Loans`
- `Export Portfolio Report`

### Table interaction model
- Column pinning
- Saved views
- Inline edit for non-critical fields
- Bulk actions (assign officer, send reminder, export)

### Fintech trust patterns
- Money values in tabular numerals
- Color + icon + label redundancy for statuses
- Human-readable audit trails per action

---

## 7) Design System Tokens (Light + Dark)

```ts
export const tokens = {
  color: {
    brand: {
      950: '#071A3E',
      900: '#0D2B5E',
      700: '#1565C0',
      500: '#2F80ED',
      300: '#93C5FD',
    },
    success: '#16A34A',
    warning: '#F59E0B',
    danger: '#DC2626',
    info: '#0284C7',
    neutral: {
      950: '#0F172A',
      900: '#1E293B',
      700: '#334155',
      500: '#64748B',
      300: '#CBD5E1',
      100: '#F1F5F9',
      50:  '#F8FAFC',
    },
    surface: {
      light: '#FFFFFF',
      dark: '#0B1220',
    },
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
  },
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
  },
  shadow: {
    sm: '0 1px 2px rgba(2,6,23,.08)',
    md: '0 8px 20px rgba(2,6,23,.10)',
    lg: '0 14px 30px rgba(2,6,23,.16)',
  },
  typography: {
    fontSans: 'Inter, DM Sans, system-ui, sans-serif',
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    h3: '24px',
    h2: '30px',
    h1: '36px',
  },
}
```

---

## 8) API Structure (REST + Webhooks)

## Auth
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

## Borrowers
- `GET /api/borrowers`
- `POST /api/borrowers`
- `GET /api/borrowers/:id`
- `PATCH /api/borrowers/:id`
- `POST /api/borrowers/:id/kyc`

## Loans
- `GET /api/loans`
- `POST /api/loans`
- `GET /api/loans/:id`
- `PATCH /api/loans/:id`
- `POST /api/loans/:id/approve`
- `POST /api/loans/:id/disburse`

## Payments
- `GET /api/payments`
- `POST /api/payments`
- `GET /api/loans/:id/payments`
- `POST /api/payments/:id/refund` (optional)

## Analytics
- `GET /api/analytics/dashboard`
- `GET /api/analytics/default-rate`
- `GET /api/analytics/portfolio-health`

## Automation
- `GET /api/automation/rules`
- `POST /api/automation/rules`
- `PATCH /api/automation/rules/:id`
- `POST /api/automation/rules/:id/test`

## Reports
- `POST /api/reports/generate`
- `GET /api/reports`
- `GET /api/reports/:id/download`

## Webhooks (Stripe-style)
- `POST /api/webhooks/payments`
- signed payload verification
- idempotency key handling
- event store for replay

---

## 9) Security Best Practices (Fintech)

- JWT short-lived access token + refresh token rotation.
- Password hashing with Argon2id.
- Row-level tenant isolation in every query path.
- Field encryption for PII (`documentNumberEnc`, bank refs).
- Immutable audit logs for sensitive actions.
- Idempotency keys for payment endpoints.
- Rate limiting + bot protection on auth and payment routes.
- Signed webhooks + replay protection.
- Fine-grained RBAC policies by module/action.
- Backup encryption and key rotation (KMS).
- SOC2-ready logging hygiene (no raw secrets in logs).

---

## 10) Developer Folder Structure

```txt
lendstack/
  apps/
    web/                      # Next.js 14
      src/
        app/
        components/
        features/
          dashboard/
          borrowers/
          loans/
          payments/
          risk/
          reports/
        lib/
        hooks/
    api/                      # NestJS
      src/
        modules/
          auth/
          organizations/
          borrowers/
          loans/
          payments/
          risk/
          automation/
          reports/
          audit/
        common/
        infra/
  packages/
    ui/                       # shared design system + shadcn wrappers
    config/                   # eslint, tsconfig, tailwind presets
    types/                    # shared API/domain types
  prisma/
    schema.prisma
    migrations/
  infrastructure/
    docker/
    terraform/
  docs/
    architecture/
    product/
```

---

## Implementation Roadmap (Suggested)

### Phase 1 (4–6 weeks): Foundations
- Design system v1 + app shell + RBAC + borrower/loan core CRUD.

### Phase 2 (4–6 weeks): Servicing & payments
- Installments, payment ledger, reminders, webhook ingestion.

### Phase 3 (4–6 weeks): Risk & reporting
- Portfolio analytics, delinquency tooling, report generation/export.

### Phase 4 (ongoing): Scale & enterprise
- SSO, advanced audit, data warehouse sync, SLA + observability hardening.

---

This blueprint is optimized for a **venture-backed fintech SaaS trajectory**: fast operator workflows today, enterprise reliability and compliance tomorrow.
