import { Role } from "@prisma/client";

/**
 * Defines the staff hierarchy for NovaStay HMS.
 *
 *   SUPER_ADMIN   → can create HOTEL_ADMIN, MANAGER, RECEPTIONIST, HOUSEKEEPING
 *                   for ANY hotel (platform-wide).
 *   HOTEL_ADMIN   → can create MANAGER, RECEPTIONIST, HOUSEKEEPING, but only
 *                   for their own hotel (the one they're assigned to).
 *   MANAGER       → can create RECEPTIONIST, HOUSEKEEPING for their own hotel.
 *   RECEPTIONIST / HOUSEKEEPING / GUEST → cannot create staff accounts.
 *
 * This is the single source of truth the users module consults so the
 * hierarchy stays consistent everywhere (creation, listing, editing).
 */
export const ROLE_HIERARCHY: Record<Role, Role[]> = {
  SUPER_ADMIN: ["HOTEL_ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
  HOTEL_ADMIN: ["MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
  MANAGER: ["RECEPTIONIST", "HOUSEKEEPING"],
  RECEPTIONIST: [],
  HOUSEKEEPING: [],
  GUEST: [],
};

/** Roles that are pinned to exactly one hotel (everyone except SUPER_ADMIN/GUEST). */
export const HOTEL_SCOPED_ROLES: Role[] = ["HOTEL_ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"];

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  return ROLE_HIERARCHY[actorRole]?.includes(targetRole) ?? false;
}

export function isHotelScoped(role: Role): boolean {
  return HOTEL_SCOPED_ROLES.includes(role);
}
