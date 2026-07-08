import { prisma } from "../../config/database";
import { ApiError } from "../../utils/ApiError";
import { AuthenticatedUser } from "../../middlewares/auth.middleware";
import { recordAudit, AuditActions } from "../../lib/auditLog";

// ---------- Hotel Types ----------
export const hotelTypesService = {
  async list(includeInactive = false) {
    return prisma.hotelType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  },
  async create(actor: AuthenticatedUser, data: any) {
    const created = await prisma.hotelType.create({ data });
    await recordAudit({
      userId: actor.id,
      action: AuditActions.HOTEL_TYPE_CREATED,
      entity: "HotelType",
      entityId: created.id,
      metadata: { name: created.name, code: created.code },
    });
    return created;
  },
  async update(actor: AuthenticatedUser, id: string, data: any) {
    const existing = await prisma.hotelType.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Hotel type not found");
    const updated = await prisma.hotelType.update({ where: { id }, data });
    await recordAudit({
      userId: actor.id,
      action: AuditActions.HOTEL_TYPE_UPDATED,
      entity: "HotelType",
      entityId: id,
      metadata: { changes: data },
    });
    return updated;
  },
  async remove(actor: AuthenticatedUser, id: string) {
    const existing = await prisma.hotelType.findUnique({
      where: { id },
      include: { _count: { select: { hotels: true } } },
    });
    if (!existing) throw ApiError.notFound("Hotel type not found");
    let result;
    if (existing._count.hotels > 0) {
      // Retire instead of hard-delete so existing hotels keep a valid reference.
      result = await prisma.hotelType.update({ where: { id }, data: { isActive: false } });
    } else {
      await prisma.hotelType.delete({ where: { id } });
      result = { id };
    }
    await recordAudit({
      userId: actor.id,
      action: AuditActions.HOTEL_TYPE_REMOVED,
      entity: "HotelType",
      entityId: id,
      metadata: { retired: existing._count.hotels > 0 },
    });
    return result;
  },
};

// ---------- Room Categories ----------
export const roomCategoriesService = {
  async list(includeInactive = false) {
    return prisma.roomCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  },
  async create(actor: AuthenticatedUser, data: any) {
    const created = await prisma.roomCategory.create({ data });
    await recordAudit({
      userId: actor.id,
      action: AuditActions.ROOM_CATEGORY_CREATED,
      entity: "RoomCategory",
      entityId: created.id,
      metadata: { name: created.name, code: created.code },
    });
    return created;
  },
  async update(actor: AuthenticatedUser, id: string, data: any) {
    const existing = await prisma.roomCategory.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Room category not found");
    const updated = await prisma.roomCategory.update({ where: { id }, data });
    await recordAudit({
      userId: actor.id,
      action: AuditActions.ROOM_CATEGORY_UPDATED,
      entity: "RoomCategory",
      entityId: id,
      metadata: { changes: data },
    });
    return updated;
  },
  async remove(actor: AuthenticatedUser, id: string) {
    const existing = await prisma.roomCategory.findUnique({
      where: { id },
      include: { _count: { select: { roomTypes: true } } },
    });
    if (!existing) throw ApiError.notFound("Room category not found");
    let result;
    if (existing._count.roomTypes > 0) {
      result = await prisma.roomCategory.update({ where: { id }, data: { isActive: false } });
    } else {
      await prisma.roomCategory.delete({ where: { id } });
      result = { id };
    }
    await recordAudit({
      userId: actor.id,
      action: AuditActions.ROOM_CATEGORY_REMOVED,
      entity: "RoomCategory",
      entityId: id,
      metadata: { retired: existing._count.roomTypes > 0 },
    });
    return result;
  },
};
