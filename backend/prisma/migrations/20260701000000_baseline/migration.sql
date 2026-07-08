-- ==========================================================
-- NovaStay HMS — Baseline migration
-- Captures the schema as it existed before the Financial
-- Management module (Auth/RBAC, Property Management,
-- Reservation Management modules). This file did not ship
-- with the project that was handed off, so `prisma migrate
-- dev`/`deploy` had no migration history to build from. It is
-- included here so migrations apply cleanly on a fresh
-- database; it does not add or change any application
-- behavior.
-- ==========================================================

-- ---------- Enums ----------
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'HOTEL_ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'GUEST');
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_PAID', 'FAILED', 'REFUNDED');
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'CASH', 'BANK_TRANSFER', 'WALLET');
CREATE TYPE "HousekeepingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED');
CREATE TYPE "HousekeepingTaskType" AS ENUM ('CHECKOUT_CLEAN', 'TURNDOWN', 'MAINTENANCE', 'DEEP_CLEAN', 'INSPECTION');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH');
CREATE TYPE "MaintenanceRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "AssetStatus" AS ENUM ('IN_SERVICE', 'UNDER_MAINTENANCE', 'RETIRED', 'DISPOSED');
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED', 'PAID');

-- ---------- Catalog / customization ----------
CREATE TABLE "hotel_types" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hotel_types_name_key" ON "hotel_types"("name");
CREATE UNIQUE INDEX "hotel_types_code_key" ON "hotel_types"("code");

CREATE TABLE "room_categories" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "room_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "room_categories_name_key" ON "room_categories"("name");
CREATE UNIQUE INDEX "room_categories_code_key" ON "room_categories"("code");

-- ---------- Core: hotels & users ----------
CREATE TABLE "hotels" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "hotelTypeId" TEXT,
  "starRating" INTEGER DEFAULT 3,
  "checkInTime" TEXT NOT NULL DEFAULT '14:00',
  "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
  "defaultTaxPercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hotels_slug_key" ON "hotels"("slug");
CREATE INDEX "hotels_slug_idx" ON "hotels"("slug");
CREATE INDEX "hotels_isActive_idx" ON "hotels"("isActive");
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_hotelTypeId_fkey" FOREIGN KEY ("hotelTypeId") REFERENCES "hotel_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT,
  "role" "Role" NOT NULL DEFAULT 'GUEST',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
  "avatarUrl" TEXT,
  "hotelId" TEXT,
  "createdById" TEXT,
  "passwordResetToken" TEXT,
  "passwordResetExpires" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_hotelId_idx" ON "users"("hotelId");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_createdById_idx" ON "users"("createdById");
ALTER TABLE "users" ADD CONSTRAINT "users_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "refresh_tokens" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revoked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "guests" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "hotelId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "idType" TEXT,
  "idNumber" TEXT,
  "nationality" TEXT,
  "address" TEXT,
  "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
  "loyaltyTier" TEXT NOT NULL DEFAULT 'BRONZE',
  "vip" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "guests_userId_key" ON "guests"("userId");
CREATE INDEX "guests_hotelId_idx" ON "guests"("hotelId");
CREATE INDEX "guests_email_idx" ON "guests"("email");
ALTER TABLE "guests" ADD CONSTRAINT "guests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guests" ADD CONSTRAINT "guests_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Rooms ----------
CREATE TABLE "room_types" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "categoryId" TEXT,
  "basePrice" DECIMAL(10,2) NOT NULL,
  "weekendPrice" DECIMAL(10,2),
  "extraBedPrice" DECIMAL(10,2),
  "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "minOccupancy" INTEGER NOT NULL DEFAULT 1,
  "maxOccupancy" INTEGER NOT NULL DEFAULT 2,
  "bedType" TEXT,
  "sizeSqft" INTEGER,
  "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "room_types_hotelId_idx" ON "room_types"("hotelId");
CREATE INDEX "room_types_hotelId_isActive_idx" ON "room_types"("hotelId", "isActive");
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "room_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "rooms" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "roomNumber" TEXT NOT NULL,
  "floor" INTEGER NOT NULL,
  "view" TEXT,
  "smokingAllowed" BOOLEAN NOT NULL DEFAULT false,
  "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "rooms_hotelId_roomNumber_key" ON "rooms"("hotelId", "roomNumber");
CREATE INDEX "rooms_hotelId_status_idx" ON "rooms"("hotelId", "status");
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Bookings ----------
CREATE TABLE "bookings" (
  "id" TEXT NOT NULL,
  "bookingRef" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "checkInDate" TIMESTAMP(3) NOT NULL,
  "checkOutDate" TIMESTAMP(3) NOT NULL,
  "actualCheckIn" TIMESTAMP(3),
  "actualCheckOut" TIMESTAMP(3),
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "adults" INTEGER NOT NULL DEFAULT 1,
  "children" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'DIRECT',
  "specialRequests" TEXT,
  "cancellationReason" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bookings_bookingRef_key" ON "bookings"("bookingRef");
CREATE INDEX "bookings_hotelId_status_idx" ON "bookings"("hotelId", "status");
CREATE INDEX "bookings_guestId_idx" ON "bookings"("guestId");
CREATE INDEX "bookings_checkInDate_checkOutDate_idx" ON "bookings"("checkInDate", "checkOutDate");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "booking_rooms" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "pricePerNight" DECIMAL(10,2) NOT NULL,
  "nights" INTEGER NOT NULL,
  CONSTRAINT "booking_rooms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_rooms_bookingId_roomId_key" ON "booking_rooms"("bookingId", "roomId");
CREATE INDEX "booking_rooms_roomId_idx" ON "booking_rooms"("roomId");
ALTER TABLE "booking_rooms" ADD CONSTRAINT "booking_rooms_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_rooms" ADD CONSTRAINT "booking_rooms_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_rooms" ADD CONSTRAINT "booking_rooms_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Payments & Invoices (pre-Financial-Management shape) ----------
CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "stripePaymentId" TEXT,
  "transactionRef" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "subtotal" DECIMAL(10,2) NOT NULL,
  "tax" DECIMAL(10,2) NOT NULL,
  "discount" DECIMAL(10,2) NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "pdfUrl" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invoices_bookingId_key" ON "invoices"("bookingId");
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Housekeeping / Staff / Notifications / Reviews ----------
CREATE TABLE "housekeeping_tasks" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "type" "HousekeepingTaskType" NOT NULL DEFAULT 'CHECKOUT_CLEAN',
  "status" "HousekeepingStatus" NOT NULL DEFAULT 'PENDING',
  "assigneeId" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "housekeeping_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "housekeeping_tasks_roomId_status_idx" ON "housekeeping_tasks"("roomId", "status");
CREATE INDEX "housekeeping_tasks_assigneeId_idx" ON "housekeeping_tasks"("assigneeId");
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "staff_shifts" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "shiftDate" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "staff_shifts_hotelId_shiftDate_idx" ON "staff_shifts"("hotelId", "shiftDate");
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "hotelId" TEXT,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'PUSH',
  "type" TEXT NOT NULL DEFAULT 'GENERAL',
  "link" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "reviews" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "cleanliness" INTEGER,
  "service" INTEGER,
  "valueForMoney" INTEGER,
  "comment" TEXT,
  "response" TEXT,
  "respondedAt" TIMESTAMP(3),
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reviews_bookingId_key" ON "reviews"("bookingId");
CREATE INDEX "reviews_hotelId_idx" ON "reviews"("hotelId");
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Assets & Maintenance ----------
CREATE TABLE "assets" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "serialNumber" TEXT,
  "location" TEXT,
  "purchaseDate" TIMESTAMP(3),
  "purchaseCost" DECIMAL(12,2),
  "warrantyExpiry" TIMESTAMP(3),
  "status" "AssetStatus" NOT NULL DEFAULT 'IN_SERVICE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "assets_hotelId_status_idx" ON "assets"("hotelId", "status");
ALTER TABLE "assets" ADD CONSTRAINT "assets_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "maintenance_requests" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "assetId" TEXT,
  "roomId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT,
  "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "MaintenanceRequestStatus" NOT NULL DEFAULT 'OPEN',
  "reportedById" TEXT,
  "assigneeId" TEXT,
  "estimatedCost" DECIMAL(12,2),
  "actualCost" DECIMAL(12,2),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "maintenance_requests_hotelId_status_idx" ON "maintenance_requests"("hotelId", "status");
CREATE INDEX "maintenance_requests_assigneeId_idx" ON "maintenance_requests"("assigneeId");
CREATE INDEX "maintenance_requests_assetId_idx" ON "maintenance_requests"("assetId");
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Expenses ----------
CREATE TABLE "expense_categories" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "expense_categories_hotelId_name_key" ON "expense_categories"("hotelId", "name");
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "expenses" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "categoryId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "vendor" TEXT,
  "isReimbursable" BOOLEAN NOT NULL DEFAULT false,
  "receiptUrl" TEXT,
  "status" "ExpenseStatus" NOT NULL DEFAULT 'SUBMITTED',
  "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expenses_hotelId_status_idx" ON "expenses"("hotelId", "status");
CREATE INDEX "expenses_submittedById_idx" ON "expenses"("submittedById");
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Audit log ----------
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
