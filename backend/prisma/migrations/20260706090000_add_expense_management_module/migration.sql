-- ==========================================================
-- Expense Management Module
-- Adds: vendors, expense attachments, expense budgets,
--       recurring expenses, high-value approval threshold
-- ==========================================================

-- ---------- Enums ----------
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- ---------- Extend "hotels" ----------
ALTER TABLE "hotels" ADD COLUMN "highValueExpenseThreshold" DECIMAL(12,2);

-- ---------- vendors ----------
CREATE TABLE "vendors" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "taxId" TEXT,
  "paymentTerms" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vendors_hotelId_name_key" ON "vendors"("hotelId", "name");
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- expense_budgets ----------
CREATE TABLE "expense_budgets" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "categoryId" TEXT,
  "year" INTEGER NOT NULL,
  "month" INTEGER,
  "amount" DECIMAL(12,2) NOT NULL,
  "alertThresholdPercent" INTEGER NOT NULL DEFAULT 90,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expense_budgets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "expense_budgets_hotelId_categoryId_year_month_key" ON "expense_budgets"("hotelId", "categoryId", "year", "month");
CREATE INDEX "expense_budgets_hotelId_year_month_idx" ON "expense_budgets"("hotelId", "year", "month");
ALTER TABLE "expense_budgets" ADD CONSTRAINT "expense_budgets_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_budgets" ADD CONSTRAINT "expense_budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- recurring_expenses ----------
CREATE TABLE "recurring_expenses" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "categoryId" TEXT,
  "vendorId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "isReimbursable" BOOLEAN NOT NULL DEFAULT false,
  "frequency" "RecurrenceFrequency" NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "nextRunDate" TIMESTAMP(3) NOT NULL,
  "lastRunAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "recurring_expenses_hotelId_isActive_nextRunDate_idx" ON "recurring_expenses"("hotelId", "isActive", "nextRunDate");
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Extend "expenses" ----------
ALTER TABLE "expenses"
  ADD COLUMN "vendorId" TEXT,
  ADD COLUMN "paymentMethod" "PaymentMethod",
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "recurringExpenseId" TEXT;

CREATE INDEX "expenses_vendorId_idx" ON "expenses"("vendorId");
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "recurring_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- expense_attachments ----------
CREATE TABLE "expense_attachments" (
  "id" TEXT NOT NULL,
  "expenseId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "fileName" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expense_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expense_attachments_expenseId_idx" ON "expense_attachments"("expenseId");
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
