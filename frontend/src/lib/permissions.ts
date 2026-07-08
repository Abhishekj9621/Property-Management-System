import type { Role } from "../types";

export const ALL_ROLES: Role[] = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING", "GUEST"];


// Mirrors the STAFF / MANAGE / REVENUE_VIEWERS role groups enforced by the
// backend's authorize() middleware, so the UI never offers a link or action
// that the API would reject.
export const STAFF: Role[] = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "RECEPTIONIST"];
export const MANAGE: Role[] = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];
export const REVENUE_VIEWERS: Role[] = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];
export const HOTEL_MANAGERS: Role[] = ["SUPER_ADMIN", "HOTEL_ADMIN"];
export const HOTEL_CREATORS: Role[] = ["SUPER_ADMIN"];
// Dashboard surfaces revenue/ADR KPIs, so it's staff-only — Housekeeping
// doesn't get it (matches GET /dashboard/overview's authorize list).
export const DASHBOARD_VIEWERS: Role[] = STAFF;
// Rooms need to be viewable by whoever can update room status, which
// includes Housekeeping (matches GET /rooms's authorize list).
export const ROOM_VIEWERS: Role[] = [...STAFF, "HOUSEKEEPING"];
export const HOUSEKEEPING_VIEWERS: Role[] = [...MANAGE, "RECEPTIONIST", "HOUSEKEEPING"];
// Any staff can report a maintenance issue or submit/track an expense claim;
// only managers see hotel-wide approvals (enforced server-side too).
export const MAINTENANCE_VIEWERS: Role[] = [...MANAGE, "RECEPTIONIST", "HOUSEKEEPING"];
export const EXPENSE_VIEWERS: Role[] = [...MANAGE, "RECEPTIONIST", "HOUSEKEEPING"];
// Expense Management module — mirrors the backend's EXPENSE_MANAGERS /
// EXPENSE_HIGH_VALUE_APPROVERS role groups in
// src/modules/expenses/shared/expense.roles.ts. EXPENSE_VIEWERS above
// already matches the backend's EXPENSE_STAFF group.
export const EXPENSE_MANAGERS: Role[] = MANAGE;
export const EXPENSE_HIGH_VALUE_APPROVERS: Role[] = ["SUPER_ADMIN", "HOTEL_ADMIN"];
// Team/hierarchy management: who can create & manage lower-level staff
// (mirrors backend's ROLE_HIERARCHY — matches /users route access).
export const USER_MANAGERS: Role[] = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];
// Platform-wide customization (Hotel Types, Currencies, Room Categories) —
// these are shared across every property, so only the Super Admin edits them.
export const SETTINGS_MANAGERS: Role[] = ["SUPER_ADMIN"];
// Auth & RBAC audit trail — same access level as staff management, since
// the events logged here are staff/account lifecycle + login activity.
export const AUDIT_LOG_VIEWERS: Role[] = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];

// Financial Management module — mirrors the backend's FINANCE_STAFF /
// FINANCE_MANAGERS / FINANCE_PERIOD_REOPENERS / FINANCE_CONSOLIDATED_VIEWERS
// role groups in src/modules/financial/shared/financial.roles.ts.
export const FINANCE_STAFF: Role[] = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "RECEPTIONIST"];
export const FINANCE_MANAGERS: Role[] = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"];
export const FINANCE_PERIOD_REOPENERS: Role[] = ["SUPER_ADMIN", "HOTEL_ADMIN"];
export const FINANCE_CONSOLIDATED_VIEWERS: Role[] = ["SUPER_ADMIN"];

// Which roles a given role is allowed to create/manage — mirrors the
// backend's ROLE_HIERARCHY in src/lib/roleHierarchy.ts. Used to build the
// "role" dropdown on the Team page so nobody is offered an option that
// the API would reject.
export const ROLE_HIERARCHY: Record<Role, Role[]> = {
  SUPER_ADMIN: ["HOTEL_ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
  HOTEL_ADMIN: ["MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
  MANAGER: ["RECEPTIONIST", "HOUSEKEEPING"],
  RECEPTIONIST: [],
  HOUSEKEEPING: [],
  GUEST: [],
};

export function can(role: Role | undefined, allowed: Role[]): boolean {
  if (!role) return false;
  return allowed.includes(role);
}
