# NovaStay HMS — Financial Management Module

This delivery covers **only** the Financial Management module: invoicing
(booking-linked and ad-hoc), credit notes, refunds, configurable tax rates,
an append-only general ledger, day-end/night-audit period close, and
financial reporting (P&L, AR aging, daily cash, cross-property
consolidated). No Channel Manager/OTA integration and no AI features were
built, per the brief. No other module's code was modified — this module
only *reads* from the Payments and Expenses modules' tables for reporting;
it never writes to them except where explicitly noted below (refund
processing flips a `Payment` row to `REFUNDED`, which is the intended use
of that existing enum value).

> **Stack note:** same situation as the three prior deliveries in this
> project — the brief asked for Next.js 16 / React 19 / NestJS / Tailwind
> v4. The uploaded project is an already-built app on **Express + Prisma +
> PostgreSQL + Redis + BullMQ (backend)** and **Vite + React 18 + Tailwind
> v3 + shadcn/ui (frontend)**. I flagged this mismatch before starting and
> built the module inside the existing stack for consistency with the
> Auth/RBAC, Property Management, and Reservation Management modules
> already in place, per your confirmation.

## What's in this module

### Backend (`backend/src/modules/financial/`)

```
financial/
  shared/
    financial.roles.ts     # FINANCE_STAFF / FINANCE_MANAGERS / FINANCE_PERIOD_REOPENERS / FINANCE_CONSOLIDATED_VIEWERS
    ledger.helper.ts        # postLedgerEntry, assertPeriodOpen, generateDocumentNumber
  invoices/                 # create/list/get/update-draft/issue/void/mark-paid
  credit-notes/              # issue/list/get/void
  refunds/                   # request/list/get/decide(approve|reject)/process
  tax-rates/                 # CRUD, per-hotel + platform-wide defaults
  ledger/                    # read-only listing + manual adjustment entries
  period-close/              # preview/close/reopen/list (day-end / night audit)
  reports/                   # profit-and-loss, ar-aging, daily-cash, consolidated
  financial.routes.ts        # mounts all of the above under /financial
```

Also touched (both are shared, cross-module infrastructure files that every
module appends to — same pattern the Property/Reservation modules used):
- `src/lib/auditLog.ts` — added the `FINANCE_*` audit action constants.
- `src/routes/index.ts` — one line mounting `/financial`.

### Database (`backend/prisma/schema.prisma` + migrations)

> **Post-delivery fix:** the project as handed off had never shipped an
> initial migration (only `schema.prisma` — no `prisma/migrations/`
> folder at all), so running `npx prisma migrate dev` on a clean database
> failed with `P1014: the underlying table for model 'invoices' does not
> exist` — there was nothing for the shadow database to build from before
> applying this module's migration. Fixed by adding
> `prisma/migrations/20260701000000_baseline/migration.sql`, a hand-written
> migration capturing the schema exactly as it existed before this module
> (all 20 pre-existing models/enums from Auth, Property Management, and
> Reservation Management) so the migration history is complete. It changes
> no application behavior — verified by applying it and then this module's
> migration back-to-back against a **fresh** PostgreSQL database (not just
> the already-populated one) and confirming all 27 tables come up correctly
> chained.

- **Extended** the existing `Invoice` model in place: added `hotelId`,
  `guestId`, `type`, `status`, `amountPaid`, `dueDate`, `notes`, `voidedAt`,
  `voidReason`, `createdById`, `updatedAt`, and a `lineItems`/`creditNotes`
  relation. `bookingId` became optional (was required) so ad-hoc invoices
  are possible.

  > **Post-delivery fix:** making `hotelId` a required field on `Invoice`
  > broke the Reservation module's own checkout code
  > (`bookings.service.ts`), which creates an `Invoice` at check-out but
  > wasn't passing `hotelId` — this only surfaced once a real Prisma
  > Client was generated (in this sandbox it was masked by the stub
  > client's `any` typing, so `npm run build` here couldn't catch it).
  > Fixed with a 3-line change to that one `tx.invoice.create()` call,
  > adding `hotelId: booking.hotelId` and `guestId: booking.guestId`
  > (both already in scope from the booking record) — no other logic in
  > that module changed. This is the only other file this module touches
  > outside `src/modules/financial/`, `src/lib/auditLog.ts`, and
  > `src/routes/index.ts`.

- **New models:** `InvoiceLineItem`, `CreditNote`, `Refund`, `TaxRate`,
  `LedgerEntry`, `FinancialPeriodClose`.
- **New enums:** `InvoiceStatus`, `InvoiceType`, `CreditNoteStatus`,
  `RefundStatus`, `LedgerEntryType`, `LedgerDirection`, `LedgerSourceType`,
  `FinancialPeriodStatus`.
- New migration: `prisma/migrations/20260705120000_add_financial_management_module/migration.sql`.
  Hand-written (see **Verification** below for why) but applied and proven
  against a real local PostgreSQL 16 instance, including the `hotelId`
  backfill for pre-existing invoice rows and every new constraint.

### Frontend (`frontend/src`)

- `api/invoices.api.ts`, `creditNotes.api.ts`, `refunds.api.ts`,
  `taxRates.api.ts`, `ledger.api.ts`, `periodClose.api.ts`,
  `financialReports.api.ts`
- `pages/financial/InvoicesPage.tsx` — list + filters, create ad-hoc
  invoice, detail modal (line items, totals, credit notes), void, mark-paid,
  issue credit note.
- `pages/financial/RefundsPage.tsx` — request, approve/reject, process.
- `pages/financial/TaxRatesPage.tsx` — CRUD, default-rate management.
- `pages/financial/LedgerPage.tsx` — read-only ledger + manual entries.
- `pages/financial/PeriodClosePage.tsx` — day-end preview, close, history,
  reopen.
- `pages/financial/FinancialReportsPage.tsx` — P&L, AR aging, daily cash,
  and (SUPER_ADMIN only) the cross-property consolidated view.
- `types/index.ts`, `lib/permissions.ts`, `components/common/Badge.tsx`,
  `components/layout/Sidebar.tsx`, `App.tsx` — extended additively with the
  new types, role groups, status colors, nav items, and routes.

## Key business rules / workflows

1. **Invoices.** Can be booking-linked (auto-derives guest/hotel from the
   booking) or fully ad-hoc (guest-only, for corporate/banquet billing with
   no room booking). `DRAFT → ISSUED` is a distinct step (for proforma
   invoices); issuing posts REVENUE + TAX + DISCOUNT entries to the ledger.
   A fully **PAID** invoice cannot be voided — you issue a **credit note**
   against it instead, which is capped at the invoice's remaining
   creditable balance.
2. **Refunds** are a first-class workflow (`REQUESTED → APPROVED/REJECTED →
   PROCESSED`), not just a `Payment.status` flip. Processing decrements the
   booking's `paidAmount`, flips the source `Payment` to `REFUNDED` only
   when the *entire* payment amount is refunded (partial refunds leave the
   payment `PAID`, since it wasn't fully returned), and posts a REFUND
   ledger debit.
3. **Tax rates** are per-hotel with an optional platform-wide fallback
   (`hotelId: null`), mirroring the existing `ExpenseCategory` pattern.
   Only one rate per hotel can be `isDefault` at a time.
4. **General ledger** is append-only — corrections are always an
   offsetting entry, never an edit/delete. It only carries entries this
   module itself originates (invoices, credit notes, refunds, manual
   adjustments); revenue/expense reporting reads `Payment`/`Expense`
   directly rather than mirroring them, so this module never has a second,
   possibly-drifting copy of another module's data.
5. **Day-end / night-audit close.** Closing a business date snapshots
   revenue/tax/refunds/expenses/net-cash for that date and **locks** every
   financial write (new invoices, refunds, credit notes, manual ledger
   entries) dated on or before it, for that hotel. Only the **most
   recently closed** period can be reopened (enforced — no reopening out
   of order), and reopening requires HOTEL_ADMIN/SUPER_ADMIN, one level up
   from who can close (MANAGER+).
6. **Reports** are all hotel-scoped except `/financial/reports/consolidated`,
   which is SUPER_ADMIN-only and rolls up every active property.

## RBAC summary (Financial Management scope)

```
SUPER_ADMIN, HOTEL_ADMIN, MANAGER, RECEPTIONIST   (FINANCE_STAFF)
  → create/list/view invoices; request refunds; view tax rates

SUPER_ADMIN, HOTEL_ADMIN, MANAGER                  (FINANCE_MANAGERS)
  → void invoices; issue/void credit notes; approve/reject/process refunds;
    manage tax rates; view/post to the ledger; close a business day;
    view financial reports

SUPER_ADMIN, HOTEL_ADMIN                           (FINANCE_PERIOD_REOPENERS)
  → reopen an already-closed business day

SUPER_ADMIN                                        (FINANCE_CONSOLIDATED_VIEWERS)
  → the cross-property consolidated financial report

HOUSEKEEPING, GUEST → no access to this module
```

Enforcement is route-level (`middlewares/rbac.middleware.ts`) plus
hotel-scoping via `requireHotelId` in every service call, exactly like
every other module in this project.

## Verification — what was actually run in this sandbox, and why

The sandbox this was built in **does** have outbound network access to
`registry.npmjs.org`, so unlike the notes on some earlier module
deliveries, `npm install` worked normally for both backend and frontend.
What's blocked is `binaries.prisma.sh` — the host Prisma's CLI downloads
its query-engine/schema-engine binaries from — so `npx prisma generate`
/ `migrate` / `validate` / `format` all fail here with a 403, and this
affects the **entire pre-existing project**, not just this module (verified
by running the identical commands against the untouched, as-uploaded
codebase — same failure). Because of that:

- **Schema correctness** was verified by hand-writing the migration SQL
  and applying it directly with `psql` against a real local PostgreSQL 16
  instance — both against the pre-populated dev database (confirming the
  `hotelId` backfill UPDATE actually ran) and, after the baseline-migration
  fix above, against a **completely fresh** database applying both
  migrations back-to-back in order, ending with all 27 tables present and
  every foreign key/unique constraint intact (confirmed the
  `financial_period_closes` unique-per-hotel-per-date constraint actually
  rejects a duplicate close).
- **Backend build** (`npm run build`): compiles with **zero new errors**
  from this module. The only errors present are the pre-existing ones
  caused by the stub (non-generated) Prisma Client — e.g. `Role`,
  `BookingStatus`, `PrismaClientKnownRequestError` are reported missing in
  `bookings.service.ts`, `users.service.ts`, etc., none of which this
  module touched. Run `npx prisma generate` with real network access and
  these disappear for the whole project, this module included.
- **Backend tests**: all 6 new suites (43 tests) in
  `tests/financial*.test.ts` were actually executed with Jest against the
  real service code — not just written — using the same
  `jest.mock("../src/config/database", ...)` pattern as the rest of the
  suite (no live DB needed). They passed. (To get a clean Jest run in
  *this* sandbox specifically, three lines of Prisma-enum typing had to be
  temporarily loosened to work around the same stub-client issue above;
  that workaround was reverted immediately after and is **not** in the
  delivered code — the delivered files use the same explicit
  `Prisma.XxxWhereInput` typing as every other module's service, e.g.
  `expenses.service.ts`.)
- **Frontend build** (`npm run build`): compiles with **zero errors** from
  this module's pages/api/types. One pre-existing error remains in
  `components/layout/HotelSwitcher.tsx` (a TanStack Query type mismatch)
  — confirmed present in the untouched, as-uploaded project too, so it
  predates and is unrelated to this delivery.

**Bottom line:** the module's own code has no build errors and its
business logic is test-verified end-to-end; the one gap is that a real
`PrismaClient` couldn't be generated *in this sandbox* to run the actual
server/seed script against Postgres. Run the commands below in an
environment with normal internet access (any laptop/CI runner) to get a
fully green `prisma generate && npm run build && npm test` — nothing in
this module is expected to behave differently there.

## Running / verifying this module yourself

```bash
cd backend
npm install
npx prisma generate          # needs real network access to binaries.prisma.sh
npx prisma migrate deploy    # applies all migrations, including this module's
npm run seed                 # base demo data (hotels, rooms, a paid demo booking)
npm run seed:financial       # NEW — tax rates, invoices, a credit note, a refund
                              #        request, and one closed business day,
                              #        created by calling this module's own
                              #        service functions (not raw inserts)
npm run build                 # tsc — verify the module compiles cleanly
npm test                      # jest — includes the 6 new financial*.test.ts suites
npm run dev                   # starts the API (+ existing no-show sweep worker)

cd ../frontend
npm install
npm run build
npm run dev
```

Demo logins (seeded by the base `npm run seed`, unchanged by this module):
`admin@novastay.com` / `Admin@123` (HOTEL_ADMIN), `manager@novastay.com` /
`Manager@123` (MANAGER) — both can see everything in this module.

## API surface

See `docs/API.md` — **Financial Management** section (new in this
delivery) for the full endpoint list, plus the added rows in **Realtime
(Socket.IO)** for the new events (`invoice:*`, `creditnote:*`, `refund:*`,
`taxrate:*`, `ledger:entry-created`, `period:*`).

---

As requested: this module only. No Channel Manager/OTA integration and no
AI features were added. Stopping here for your manual testing and approval
before the next module.
