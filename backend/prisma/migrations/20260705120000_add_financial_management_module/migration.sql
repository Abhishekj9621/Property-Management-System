-- ==========================================================
-- Financial Management Module
-- Adds: invoice line items, credit notes, refunds, tax rates,
--       general ledger, financial period close
-- Extends: invoices (hotel scoping, status/type, ad-hoc support)
-- ==========================================================

-- ---------- Enums ----------
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');
CREATE TYPE "InvoiceType" AS ENUM ('STANDARD', 'PROFORMA');
CREATE TYPE "CreditNoteStatus" AS ENUM ('ISSUED', 'VOID');
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSED');
CREATE TYPE "LedgerEntryType" AS ENUM ('REVENUE', 'TAX', 'DISCOUNT', 'REFUND', 'EXPENSE', 'ADJUSTMENT');
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "LedgerSourceType" AS ENUM ('BOOKING', 'INVOICE', 'PAYMENT', 'EXPENSE', 'REFUND', 'CREDIT_NOTE', 'MANUAL');
CREATE TYPE "FinancialPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- ---------- Extend "invoices" ----------
ALTER TABLE "invoices"
  ADD COLUMN "hotelId" TEXT,
  ADD COLUMN "guestId" TEXT,
  ADD COLUMN "type" "InvoiceType" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
  ADD COLUMN "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidReason" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill hotelId for any pre-existing invoices from their booking, then
-- lock the column down to NOT NULL now that every row has a value.
UPDATE "invoices" i
SET "hotelId" = b."hotelId"
FROM "bookings" b
WHERE i."bookingId" = b."id" AND i."hotelId" IS NULL;

ALTER TABLE "invoices" ALTER COLUMN "hotelId" SET NOT NULL;

-- bookingId becomes optional so ad-hoc (non-booking) invoices are possible.
-- The existing unique constraint on bookingId is preserved (Postgres allows
-- multiple NULLs in a unique index).
ALTER TABLE "invoices" ALTER COLUMN "bookingId" DROP NOT NULL;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "invoices_hotelId_status_idx" ON "invoices"("hotelId", "status");
CREATE INDEX "invoices_guestId_idx" ON "invoices"("guestId");

-- ---------- invoice_line_items ----------
CREATE TABLE "invoice_line_items" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "amount" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "invoice_line_items_invoiceId_idx" ON "invoice_line_items"("invoiceId");
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- credit_notes ----------
CREATE TABLE "credit_notes" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "creditNoteNumber" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" "CreditNoteStatus" NOT NULL DEFAULT 'ISSUED',
  "issuedById" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),

  CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "credit_notes_creditNoteNumber_key" ON "credit_notes"("creditNoteNumber");
CREATE INDEX "credit_notes_hotelId_idx" ON "credit_notes"("hotelId");
CREATE INDEX "credit_notes_invoiceId_idx" ON "credit_notes"("invoiceId");
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_issuedById_fkey"
  FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- refunds ----------
CREATE TABLE "refunds" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "paymentId" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "transactionRef" TEXT,
  "requestedById" TEXT,
  "approvedById" TEXT,
  "rejectionReason" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "refunds_hotelId_status_idx" ON "refunds"("hotelId", "status");
CREATE INDEX "refunds_bookingId_idx" ON "refunds"("bookingId");
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- tax_rates ----------
CREATE TABLE "tax_rates" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "percentage" DECIMAL(5,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tax_rates_hotelId_name_key" ON "tax_rates"("hotelId", "name");
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- ledger_entries ----------
CREATE TABLE "ledger_entries" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "type" "LedgerEntryType" NOT NULL,
  "direction" "LedgerDirection" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "description" TEXT NOT NULL,
  "sourceType" "LedgerSourceType" NOT NULL,
  "sourceId" TEXT,
  "referenceCode" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ledger_entries_hotelId_entryDate_idx" ON "ledger_entries"("hotelId", "entryDate");
CREATE INDEX "ledger_entries_sourceType_sourceId_idx" ON "ledger_entries"("sourceType", "sourceId");
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- financial_period_closes ----------
CREATE TABLE "financial_period_closes" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "status" "FinancialPeriodStatus" NOT NULL DEFAULT 'CLOSED',
  "totalRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalRefunds" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalExpenses" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "netCashPosition" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "closedById" TEXT,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reopenedById" TEXT,
  "reopenedAt" TIMESTAMP(3),

  CONSTRAINT "financial_period_closes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "financial_period_closes_hotelId_businessDate_key" ON "financial_period_closes"("hotelId", "businessDate");
CREATE INDEX "financial_period_closes_hotelId_status_idx" ON "financial_period_closes"("hotelId", "status");
ALTER TABLE "financial_period_closes" ADD CONSTRAINT "financial_period_closes_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_period_closes" ADD CONSTRAINT "financial_period_closes_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_period_closes" ADD CONSTRAINT "financial_period_closes_reopenedById_fkey"
  FOREIGN KEY ("reopenedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
