import bcrypt from "bcryptjs";
import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import { ApiError } from "../../utils/ApiError";
import { AuthenticatedUser } from "../../middlewares/auth.middleware";
import { canManageRole, ROLE_HIERARCHY } from "../../lib/roleHierarchy";
import { recordAudit, AuditActions } from "../../lib/auditLog";
import { Role } from "@prisma/client";

const SALT_ROUNDS = 12;

const publicSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  hotelId: true,
  isActive: true,
  isEmailVerified: true,
  avatarUrl: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  hotel: { select: { id: true, name: true, slug: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
} as const;

interface CreateStaffInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: Role;
  hotelId?: string;
}

/**
 * Resolves & authorizes the hotelId a staff account being created/edited
 * should be pinned to, given who's creating it. SUPER_ADMIN can assign any
 * active hotel; anyone else can only ever staff their own hotel, regardless
 * of what the request body says — this is what actually enforces "a manager
 * only has access to the specific hotel they were assigned to."
 */
async function resolveHotelIdForRole(actor: AuthenticatedUser, role: Role, requestedHotelId?: string | null) {
  if (role === "SUPER_ADMIN") return null;

  if (actor.role === "SUPER_ADMIN") {
    if (!requestedHotelId) {
      throw ApiError.badRequest("hotelId is required when creating staff for a specific hotel");
    }
    const hotel = await prisma.hotel.findUnique({ where: { id: requestedHotelId } });
    if (!hotel || !hotel.isActive) throw ApiError.badRequest("Selected hotel does not exist or is inactive");
    return hotel.id;
  }

  // Hotel-scoped creators (HOTEL_ADMIN, MANAGER) can only ever staff their own property.
  if (!actor.hotelId) throw ApiError.forbidden("Your account isn't assigned to a hotel");
  return actor.hotelId;
}

export const usersService = {
  async create(actor: AuthenticatedUser, input: CreateStaffInput) {
    if (input.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
      throw ApiError.forbidden("Only a Super Admin can create another Super Admin");
    }
    if (input.role !== "SUPER_ADMIN" && !canManageRole(actor.role as Role, input.role)) {
      throw ApiError.forbidden(`Your role (${actor.role}) is not permitted to create a ${input.role} account`);
    }

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw ApiError.conflict("An account with this email already exists");

    const hotelId = await resolveHotelIdForRole(actor, input.role, input.hotelId);
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const created = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: input.role,
        hotelId,
        isEmailVerified: true, // staff accounts are provisioned by an admin, not self-registered
        createdById: actor.id,
      },
      select: publicSelect,
    });

    await recordAudit({
      userId: actor.id,
      action: AuditActions.STAFF_CREATED,
      entity: "User",
      entityId: created.id,
      metadata: { role: created.role, hotelId: created.hotelId, email: created.email },
    });

    return created;
  },

  async list(
    actor: AuthenticatedUser,
    filters: { hotelId?: string; role?: Role; includeInactive?: boolean; search?: string }
  ) {
    const where: any = {
      role: { not: "GUEST" }, // this endpoint is for staff management, not the guest portal
    };

    if (actor.role === "SUPER_ADMIN") {
      if (filters.hotelId) where.hotelId = filters.hotelId;
      if (filters.role) where.role = filters.role;
    } else {
      // Hotel-scoped staff only ever see people in their own hotel, and only
      // roles they're permitted to manage (their "team"), plus themselves.
      const manageable = ROLE_HIERARCHY[actor.role as Role];
      where.hotelId = actor.hotelId;
      where.OR = [{ role: { in: manageable } }, { id: actor.id }];
      if (filters.role && manageable.includes(filters.role)) where.role = filters.role;
    }

    if (!filters.includeInactive) where.isActive = true;
    if (filters.search) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { firstName: { contains: filters.search, mode: "insensitive" } },
            { lastName: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
          ],
        },
      ];
    }

    return prisma.user.findMany({ where, select: publicSelect, orderBy: [{ role: "asc" }, { firstName: "asc" }] });
  },

  async get(actor: AuthenticatedUser, id: string) {
    const user = await prisma.user.findUnique({ where: { id }, select: publicSelect });
    if (!user) throw ApiError.notFound("User not found");
    this.assertInScope(actor, user);
    return user;
  },

  /** Throws 403 unless `actor` is allowed to view/manage `target`. */
  assertInScope(actor: AuthenticatedUser, target: { id: string; role: Role; hotelId: string | null }) {
    if (actor.role === "SUPER_ADMIN") return;
    if (target.id === actor.id) return;
    if (target.hotelId !== actor.hotelId) throw ApiError.forbidden("You do not have access to this hotel's staff");
    if (!canManageRole(actor.role as Role, target.role)) {
      throw ApiError.forbidden("You do not have permission to manage this account");
    }
  },

  async update(
    actor: AuthenticatedUser,
    id: string,
    data: { firstName?: string; lastName?: string; phone?: string; role?: Role; hotelId?: string | null; isActive?: boolean }
  ) {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw ApiError.notFound("User not found");
    this.assertInScope(actor, target as any);

    if (id === actor.id && (data.role || data.isActive === false || data.hotelId !== undefined)) {
      throw ApiError.badRequest("You can't change your own role, active status, or hotel assignment here");
    }

    const updateData: any = {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    };

    if (data.role && data.role !== target.role) {
      if (data.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
        throw ApiError.forbidden("Only a Super Admin can promote an account to Super Admin");
      }
      if (data.role !== "SUPER_ADMIN" && !canManageRole(actor.role as Role, data.role)) {
        throw ApiError.forbidden(`Your role is not permitted to assign the ${data.role} role`);
      }
      updateData.role = data.role;
    }

    if (data.hotelId !== undefined) {
      if (actor.role !== "SUPER_ADMIN") {
        throw ApiError.forbidden("Only a Super Admin can reassign a staff member to a different hotel");
      }
      if (data.hotelId) {
        const hotel = await prisma.hotel.findUnique({ where: { id: data.hotelId } });
        if (!hotel || !hotel.isActive) throw ApiError.badRequest("Selected hotel does not exist or is inactive");
      }
      updateData.hotelId = (data.role ?? target.role) === "SUPER_ADMIN" ? null : data.hotelId;
    }

    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.user.update({ where: { id }, data: updateData, select: publicSelect });

    if (data.isActive === false) {
      await prisma.refreshToken.updateMany({ where: { userId: id }, data: { revoked: true } });
      await redis.set(`deactivated:${id}`, "1", "EX", 60 * 60 * 24 * 30);
    } else if (data.isActive === true) {
      await redis.del(`deactivated:${id}`);
    }

    await recordAudit({
      userId: actor.id,
      action: updateData.role ? AuditActions.STAFF_ROLE_CHANGED : AuditActions.STAFF_UPDATED,
      entity: "User",
      entityId: id,
      metadata: { changes: updateData, previousRole: target.role },
    });

    return updated;
  },

  async resetPassword(actor: AuthenticatedUser, id: string, newPassword: string) {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw ApiError.notFound("User not found");
    this.assertInScope(actor, target as any);

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { passwordHash } }),
      prisma.refreshToken.updateMany({ where: { userId: id }, data: { revoked: true } }),
    ]);
    await recordAudit({
      userId: actor.id,
      action: AuditActions.STAFF_PASSWORD_RESET,
      entity: "User",
      entityId: id,
    });
    return { id };
  },

  async deactivate(actor: AuthenticatedUser, id: string) {
    if (id === actor.id) throw ApiError.badRequest("You can't deactivate your own account");
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw ApiError.notFound("User not found");
    this.assertInScope(actor, target as any);

    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { isActive: false } }),
      prisma.refreshToken.updateMany({ where: { userId: id }, data: { revoked: true } }),
    ]);
    // Revoking refresh tokens only stops future refreshes — the user's
    // current access token (up to JWT_ACCESS_EXPIRES_IN old) would otherwise
    // keep working until it naturally expires. This flag makes deactivation
    // take effect on the very next request instead. 30-day TTL is just a
    // safety net against an unbounded Redis key if `restore` is never called;
    // `restore` below deletes it immediately in the normal case.
    await redis.set(`deactivated:${id}`, "1", "EX", 60 * 60 * 24 * 30);
    await recordAudit({ userId: actor.id, action: AuditActions.STAFF_DEACTIVATED, entity: "User", entityId: id });
    return { id };
  },

  async restore(actor: AuthenticatedUser, id: string) {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw ApiError.notFound("User not found");
    this.assertInScope(actor, target as any);
    const restored = await prisma.user.update({ where: { id }, data: { isActive: true }, select: publicSelect });
    await redis.del(`deactivated:${id}`);
    await recordAudit({ userId: actor.id, action: AuditActions.STAFF_RESTORED, entity: "User", entityId: id });
    return restored;
  },
};
