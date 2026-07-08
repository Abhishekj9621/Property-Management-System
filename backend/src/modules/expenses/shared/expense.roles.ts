/**
 * Role groups for the Expense Management module. Mirrors the pattern used
 * by the Financial Management module (financial.roles.ts) for consistency.
 */

// Any staff member can submit/track their own expense claims, upload
// receipts, and view active vendors — but not approve, manage budgets, or
// see the full hotel-wide ledger of everyone else's expenses (the service
// layer additionally scopes non-managers to their own submissions).
export const EXPENSE_STAFF = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"];

// Can approve/reject expenses (below the high-value threshold), manage
// categories/vendors/budgets/recurring expenses, and view reports.
export const EXPENSE_MANAGERS = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];

// Expenses at/above a hotel's configured highValueExpenseThreshold need
// this higher tier instead of a plain MANAGER — enforced in the service.
export const EXPENSE_HIGH_VALUE_APPROVERS = ["SUPER_ADMIN", "HOTEL_ADMIN"];
