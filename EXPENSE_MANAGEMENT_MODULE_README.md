# NovaStay HMS — Expense Management Module

This delivery covers **only** the Expense Management module. A thin
Expense/ExpenseCategory CRUD already existed in the codebase (built as a
side-effect of an earlier module); this delivery substantially completes
it into a full module: vendor master data, budgets with proactive alerts,
multi-level (high-value) approval, recurring/auto-generated expenses,
receipt attachments, payment/reimbursement tracking, reports, audit
logging (previously entirely missing), and RBAC role groups. No Channel
Manager/OTA integration and no AI features were built, per the brief. No
other module's code was modified except a documented one-line-per-file
fix set (see below) needed because the pre-existing `Expense`/`Hotel`
models are shared infrastructure this module extends.

> **Stack note:** same situation as the prior deliveries in this project —
> the brief asked for Next.js 16 / React 19 / NestJS / Tailwind v4. The
> project is an already-built app on **Express + Prisma + PostgreSQL +
> Redis + BullMQ (backend)** and **Vite + React 18 + Tailwind v3 +
> shadcn/ui (frontend)**. Built inside the existing stack for consistency
> with every module already in place.

## What's in this module

### Backend (`backend/src/modules/expenses/`)

```
expenses/
  shared/
    expense.roles.ts        # EXPENSE_STAFF / EXPENSE_MANAGERS / EXPENSE_HIGH_VALUE_APPROVERS
  expenses.schema.ts         # extended: vendorId, attachments[], payment method/reference
  expenses.service.ts        # extended: high-value approval threshold, budget-alert hook,
                              #           attachments, vendor linkage, payment tracking
  expenses.controller.ts     # extended: audit logging added (there was none before)
  expenses.routes.ts         # extended: mounts the four sub-modules below
  vendors/                   # NEW — vendor master data (CRUD + spend summary)
  budgets/                   # NEW — budget envelopes + live spend tracking + alerts
  recurring/                 # NEW — recurring expense templates + daily auto-generation
  reports/                   # NEW — summary, by-category, by-vendor, monthly trend
```

Also touched:
- `src/lib/auditLog.ts` — added `EXPENSE_*` / `VENDOR_*` / `RECURRING_EXPENSE_*` audit
  action constants (shared infra every module appends to, same as prior deliveries).
- `src/routes/index.ts` — unchanged; `/expenses` was already mounted and now
  internally routes to the new sub-modules (`/expenses/vendors`, `/expenses/budgets`,
  `/expenses/recurring`, `/expenses/reports`).
- `src/server.ts` / `src/worker.ts` — added the daily recurring-expense sweep
  alongside the existing hourly no-show sweep (same BullMQ pattern).

### Database (`backend/prisma/schema.prisma` + migration)

- **Extended `Expense`** in place: added `vendorId`, `paymentMethod`,
  `paymentReference`, `paidAt`, `recurringExpenseId`, and an `attachments`
  relation. The original `vendor` free-text field and every existing
  column/behavior is unchanged — old code paths keep working.
- **Extended `ExpenseCategory`**: added `budgets`/`recurringExpenses` relations.
- **Extended `Hotel`**: added `highValueExpenseThreshold` (nullable — no
  behavior change for hotels that don't set it).
- **New models:** `Vendor`, `ExpenseAttachment`, `ExpenseBudget`, `RecurringExpense`.
- **New enum:** `RecurrenceFrequency`.
- New migration:
  `prisma/migrations/20260706090000_add_expense_management_module/migration.sql`.
  Hand-written (see **Verification** below for why) and verified by applying
  the **entire migration history** (baseline → Financial Management →
  this module) against a fresh PostgreSQL 16 database in sequence, ending
  with all 31 tables present and every constraint intact.

### Frontend (`frontend/src`)

- `api/expenses.api.ts` (extended: attachments, category update),
  `vendors.api.ts`, `expenseBudgets.api.ts`, `recurringExpenses.api.ts`,
  `expenseReports.api.ts` (all new)
- `pages/expenses/ExpensesPage.tsx` — extended: vendor picker (dropdown +
  free-text fallback), receipt attachments, payment method/reference
  prompts when marking reimbursed/paid.
- `pages/expenses/VendorsPage.tsx` — NEW — CRUD + per-vendor spend summary.
- `pages/expenses/ExpenseBudgetsPage.tsx` — NEW — budget cards with a
  live progress bar (committed spend vs. limit) per category/period.
- `pages/expenses/RecurringExpensesPage.tsx` — NEW — templates, pause/resume, delete.
- `pages/expenses/ExpenseReportsPage.tsx` — NEW — summary KPIs, by-category,
  by-vendor, and a monthly trend bar chart.
- `types/index.ts`, `lib/permissions.ts`, `components/layout/Sidebar.tsx`,
  `App.tsx` — extended additively.
- **Sidebar UX**: Expense Management now collapses into one nav entry
  (mirroring the Financial Management group from the prior delivery) —
  the group-rendering logic was generalized into a reusable `navGroups`
  array so both modules (and any future one) share the same
  expand/collapse component instead of duplicating it.

## Key business rules / workflows

1. **Claims workflow.** `SUBMITTED → APPROVED/REJECTED → REIMBURSED` (for
   personal claims) or `→ PAID` (for vendor bills). Only the original
   submitter (while SUBMITTED) or a manager can edit; only DRAFT/SUBMITTED/
   REJECTED can be deleted — once decided, the record is an audit trail.
2. **Multi-level (high-value) approval.** If a hotel sets
   `highValueExpenseThreshold`, approving an expense at/above that amount
   requires HOTEL_ADMIN/SUPER_ADMIN instead of a plain MANAGER — enforced
   in `expensesService.decideExpense`, which checks the specific expense's
   amount against the hotel's configured threshold at approval time.
3. **Vendors** are per-hotel with an optional platform-wide fallback
   (`hotelId: null`), mirroring `ExpenseCategory`'s existing pattern.
   Expenses can still use the free-text `vendor` field for quick one-off
   entries without creating a Vendor record.
4. **Budgets** never store a running total — `committedSpend` (everything
   not yet rejected) and `actualSpend` (approved/reimbursed/paid only) are
   always computed live from `Expense` rows for the period, so they can
   never drift out of sync. The moment a new (or newly-generated
   recurring) expense pushes committed spend across the budget's alert
   threshold, every manager/admin at that hotel gets an in-app
   notification — but only on the crossing itself, not on every
   subsequent expense once already over, to avoid alert spam.
5. **Recurring expenses** are templates a daily BullMQ sweep scans for
   due `nextRunDate`s, generating a real `SUBMITTED` `Expense` from each
   and advancing `nextRunDate` by the template's frequency (auto-pausing
   once past `endDate`). Generated expenses link back via
   `Expense.recurringExpenseId` so their origin is always traceable, and
   deleting a template leaves its already-generated expenses' history
   intact (the FK is `ON DELETE SET NULL`).
6. **Attachments** support multiple receipts/documents per expense (the
   original single `receiptUrl` field is kept for anything written before
   this module existed).

## RBAC summary (Expense Management scope)

```
SUPER_ADMIN, HOTEL_ADMIN, MANAGER, RECEPTIONIST, HOUSEKEEPING  (EXPENSE_STAFF)
  → submit/track own claims, add attachments, view active vendors/categories

SUPER_ADMIN, HOTEL_ADMIN, MANAGER                              (EXPENSE_MANAGERS)
  → approve/reject/reimburse/pay (below the high-value threshold),
    manage categories/vendors/budgets/recurring expenses, view reports

SUPER_ADMIN, HOTEL_ADMIN                          (EXPENSE_HIGH_VALUE_APPROVERS)
  → approve expenses at/above the hotel's configured high-value threshold
```

## Post-delivery-style fixes made *during this delivery* (not after)

Because `Expense` and `Hotel` are shared models other modules already
write to, two things needed care while extending them — both were caught
and fixed before packaging, unlike the Financial Management module's
`Invoice.hotelId` issue which only surfaced after handoff:

- `Expense.vendorId`/`recurringExpenseId`/etc. were added as **optional**
  columns, so the Reservation/Financial modules' existing code (which
  never sets them) keeps compiling and running unchanged.
- `Hotel.highValueExpenseThreshold` was added as **optional** (nullable,
  no default requirement), so every existing `Hotel` row and every
  existing `hotel.create()`/`update()` call elsewhere in the codebase is
  unaffected.

Both were specifically checked by grepping the whole backend for every
other write to these models and confirming no required field was
introduced — the lesson from the Financial module's `Invoice.hotelId`
incident.

## Verification — what was actually run in this sandbox, and why

Same sandbox constraint as the prior two deliveries: outbound network
access to `registry.npmjs.org` works fine (`npm install` succeeded
normally for both backend and frontend), but `binaries.prisma.sh` — the
host Prisma's CLI downloads its query-engine/schema-engine binaries from —
is not reachable, so `npx prisma generate/migrate/validate/format` all
fail here with a 403. This affects the **whole pre-existing project**, not
just this module (verified again by re-running the identical commands
against files this module didn't touch).

- **Schema correctness**: the migration SQL was hand-written and then
  applied for real with `psql` against a fresh local PostgreSQL 16 —
  **all three migrations in sequence** (baseline → Financial Management →
  this module), ending with all 31 tables present and constraints intact
  (confirmed the `expense_budgets` unique-per-hotel/category/period
  constraint actually rejects a duplicate, exactly like the Financial
  module's period-close constraint was confirmed previously).
- **Backend build** (`npm run build`): **zero new errors** from this
  module. The only errors present are the pre-existing ones caused by the
  stub (non-generated) Prisma Client — the same category of error already
  documented in the Financial Management README, now also naturally
  appearing on `expenses.service.ts` for the same reason (it also now uses
  a `Prisma.ExpenseWhereInput` type). Confirmed identical root cause by
  checking that `expenses.service.ts`'s *only* build error is that one
  missing-type diagnostic, nothing else.
- **Backend tests**: all 5 new suites (39 tests) in
  `tests/{expensesService,vendorsService,budgetsService,recurringExpenseService,
  expenseReportsService}.test.ts` were actually executed with Jest — not
  just written — using the same `jest.mock("../src/config/database", ...)`
  pattern as the rest of the suite. They passed. As with the Financial
  module, getting a clean Jest run in *this specific sandbox* required
  briefly loosening one `Prisma.ExpenseWhereInput` type annotation to work
  around the stub-client issue above; that workaround was reverted
  immediately after and is **not** in the delivered code (confirmed by
  diffing the restored file against the pre-edit backup).
- **Frontend build** (`npm run build`): **zero errors** from this module's
  pages/api/types/Sidebar. The one pre-existing error in
  `components/layout/HotelSwitcher.tsx` (a TanStack Query type mismatch,
  documented in the Financial Management README) remains, unrelated to
  this delivery.

## Running / verifying this module yourself

```bash
cd backend
npm install
npx prisma generate          # needs real network access to binaries.prisma.sh
npx prisma migrate deploy    # applies all migrations, including this module's
npm run seed                  # base demo data
npm run seed:financial        # Financial Management demo data (optional, prior module)
npm run seed:expenses         # NEW — categories, vendors, budgets, a recurring
                               #       expense (with its first occurrence actually
                               #       generated), and sample expenses across every
                               #       workflow state incl. a high-value example —
                               #       created by calling this module's own service
                               #       functions, not raw inserts
npm run build                  # tsc — verify the module compiles cleanly
npm test                       # jest — includes the 5 new *Service.test.ts suites
npm run dev                    # starts the API (+ no-show sweep + recurring-expense sweep)

cd ../frontend
npm install
npm run build
npm run dev
```

Demo logins (seeded by the base `npm run seed`, unchanged by this module):
`admin@novastay.com` / `Admin@123` (HOTEL_ADMIN — can approve high-value
expenses), `manager@novastay.com` / `Manager@123` (MANAGER — cannot
approve the seeded ₹65,000 payroll contract; try it to see the 403).

## API surface

See `docs/API.md` — **Expense Management** section (new in this delivery,
placed before Financial Management) for the full endpoint list, plus the
added rows in **Realtime (Socket.IO)** for the new events (`expense:*`,
`expense-category:*`, `vendor:*`, `expense-budget:*`, `recurring-expense:*`).

---

As requested: this module only. No Channel Manager/OTA integration and no
AI features were added. Stopping here for your manual testing and approval
before the next module.
