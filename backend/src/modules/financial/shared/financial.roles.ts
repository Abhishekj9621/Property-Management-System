/**
 * Role groups for the Financial Management module. Mirrors the pattern used
 * by every other module (payments.routes.ts's STAFF/REVENUE_VIEWERS, etc.)
 * so access rules stay legible and consistent across the codebase.
 */

// Can view invoices/refunds/tax rates and create invoices or request refunds,
// but cannot approve refunds, edit tax rates, or close a financial period.
export const FINANCE_STAFF = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "RECEPTIONIST"];

// Can approve/reject/process refunds, manage tax rates, view the ledger,
// close/reopen financial periods, and view financial reports.
export const FINANCE_MANAGERS = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];

// Only property-level or platform admins can reopen an already-closed
// financial period — a deliberate, higher bar than closing it.
export const FINANCE_PERIOD_REOPENERS = ["SUPER_ADMIN", "HOTEL_ADMIN"];

// Consolidated (cross-property) financial dashboard is platform-level only.
export const FINANCE_CONSOLIDATED_VIEWERS = ["SUPER_ADMIN"];
