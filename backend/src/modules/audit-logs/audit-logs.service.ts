import { prisma } from "../../config/database";
import { AuthenticatedUser } from "../../middlewares/auth.middleware";

interface ListFilters {
  action?: string;
  entity?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Read-only access to the Auth & RBAC audit trail. SUPER_ADMIN sees
 * everything; HOTEL_ADMIN/MANAGER only see audit events for users who
 * belong to their own hotel (self included), keeping cross-property
 * data isolated the same way every other module in this system is
 * scoped by hotelId.
 */
export const auditLogsService = {
  async list(actor: AuthenticatedUser, filters: ListFilters) {
    const page = Math.max(filters.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);

    const where: any = {};
    if (filters.action) where.action = filters.action;
    if (filters.entity) where.entity = filters.entity;
    if (filters.userId) where.userId = filters.userId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    if (actor.role !== "SUPER_ADMIN") {
      // Scope to users belonging to the actor's hotel (or with no hotel,
      // e.g. a guest self-registration event isn't hotel-scoped at all —
      // exclude those for non-super-admins since it's not "their" data).
      where.user = { hotelId: actor.hotelId };
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },
};
