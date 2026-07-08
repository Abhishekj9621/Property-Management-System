import { prisma } from "../../config/database";
import { ApiError } from "../../utils/ApiError";
import { AuthenticatedUser } from "../../middlewares/auth.middleware";
import { recordAudit, AuditActions } from "../../lib/auditLog";

const includeRelations = {
  hotelType: true,
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  _count: { select: { rooms: true, bookings: true, guests: true, users: true } },
};

export const hotelsService = {
  async create(actor: AuthenticatedUser, data: any) {
    const { reactivateIfInactive, ...hotelData } = data;

    if (hotelData.hotelTypeId) {
      const type = await prisma.hotelType.findUnique({ where: { id: hotelData.hotelTypeId } });
      if (!type || !type.isActive) throw ApiError.badRequest("Selected hotel type does not exist or is inactive");
    }

    // Hotels are soft-deleted (isActive: false) so historical bookings/guests
    // survive a "delete" — but that means the slug is still taken in the DB
    // even though the hotel is invisible in the active list. Without this
    // check, re-adding a hotel with a previously-used slug fails with an
    // opaque uniqueness error and looks like "I can't add hotels anymore."
    const existingBySlug = await prisma.hotel.findUnique({ where: { slug: hotelData.slug } });
    if (existingBySlug) {
      if (existingBySlug.isActive) {
        throw ApiError.conflict(`A hotel with the slug "${hotelData.slug}" already exists`);
      }
      if (!reactivateIfInactive) {
        throw ApiError.conflict(
          `A deactivated hotel already uses the slug "${hotelData.slug}". Restore it from the Inactive tab, choose a different slug, or resubmit with reactivateIfInactive to reuse it.`
        );
      }
      // Reuse the slug: reactivate + overwrite the old deactivated record
      // instead of failing on the unique constraint.
      const reactivated = await prisma.hotel.update({
        where: { id: existingBySlug.id },
        data: { ...hotelData, isActive: true, createdById: actor.id },
        include: includeRelations,
      });
      await recordAudit({
        userId: actor.id,
        action: AuditActions.HOTEL_CREATED,
        entity: "Hotel",
        entityId: reactivated.id,
        metadata: { name: reactivated.name, slug: reactivated.slug, reactivated: true },
      });
      return reactivated;
    }

    const created = await prisma.hotel.create({ data: { ...hotelData, createdById: actor.id }, include: includeRelations });
    await recordAudit({
      userId: actor.id,
      action: AuditActions.HOTEL_CREATED,
      entity: "Hotel",
      entityId: created.id,
      metadata: { name: created.name, slug: created.slug },
    });
    return created;
  },

  async list(actor: AuthenticatedUser | undefined, filters: { status?: "active" | "inactive" | "all"; search?: string }) {
    const where: any = {};

    // Staff pinned to one hotel only ever see their own property, no matter
    // what status/search filters they pass.
    if (actor && actor.role !== "SUPER_ADMIN" && actor.hotelId) {
      where.id = actor.hotelId;
    } else {
      const status = actor?.role === "SUPER_ADMIN" ? (filters.status ?? "active") : "active";
      if (status === "active") where.isActive = true;
      if (status === "inactive") where.isActive = false;
      // status === "all" → no isActive filter
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { city: { contains: filters.search, mode: "insensitive" } },
        { country: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return prisma.hotel.findMany({ where, orderBy: { name: "asc" }, include: includeRelations });
  },

  async get(id: string) {
    const hotel = await prisma.hotel.findUnique({ where: { id }, include: includeRelations });
    if (!hotel) throw ApiError.notFound("Hotel not found");
    return hotel;
  },

  /** Non-SUPER_ADMIN staff may only act on their own hotel. */
  assertOwnHotel(actor: AuthenticatedUser, hotelId: string) {
    if (actor.role === "SUPER_ADMIN") return;
    if (actor.hotelId !== hotelId) throw ApiError.forbidden("You do not have access to this hotel");
  },

  async update(actor: AuthenticatedUser, id: string, data: any) {
    await this.get(id);
    this.assertOwnHotel(actor, id);

    if (data.hotelTypeId) {
      const type = await prisma.hotelType.findUnique({ where: { id: data.hotelTypeId } });
      if (!type || !type.isActive) throw ApiError.badRequest("Selected hotel type does not exist or is inactive");
    }

    const updated = await prisma.hotel.update({ where: { id }, data, include: includeRelations });
    await recordAudit({
      userId: actor.id,
      action: AuditActions.HOTEL_UPDATED,
      entity: "Hotel",
      entityId: id,
      metadata: { changes: data },
    });
    return updated;
  },

  // Hotels carry rooms, bookings, guests, and staff, so deletion is a soft
  // deactivation rather than a hard delete — this preserves historical
  // records while removing the property from the active portfolio list.
  async remove(actor: AuthenticatedUser, id: string) {
    await this.get(id);
    this.assertOwnHotel(actor, id);
    const updated = await prisma.hotel.update({ where: { id }, data: { isActive: false }, include: includeRelations });
    await recordAudit({ userId: actor.id, action: AuditActions.HOTEL_DEACTIVATED, entity: "Hotel", entityId: id });
    return updated;
  },

  async restore(actor: AuthenticatedUser, id: string) {
    const hotel = await this.get(id);
    if (hotel.isActive) throw ApiError.badRequest("Hotel is already active");
    const updated = await prisma.hotel.update({ where: { id }, data: { isActive: true }, include: includeRelations });
    await recordAudit({ userId: actor.id, action: AuditActions.HOTEL_RESTORED, entity: "Hotel", entityId: id });
    return updated;
  },

  // A genuine hard delete — only offered for hotels with zero historical
  // activity, so nobody accidentally erases financial/guest records. For
  // anything with history, use `remove` (deactivate) instead.
  async permanentlyDelete(actor: AuthenticatedUser, id: string) {
    const hotel = await prisma.hotel.findUnique({
      where: { id },
      include: { _count: { select: { bookings: true, guests: true, rooms: true, users: true } } },
    });
    if (!hotel) throw ApiError.notFound("Hotel not found");
    if (hotel.isActive) throw ApiError.badRequest("Deactivate the hotel before permanently deleting it");
    const { bookings, guests, rooms, users } = hotel._count;
    if (bookings > 0 || guests > 0 || users > 0) {
      throw ApiError.conflict(
        "This hotel has bookings, guests, or staff on record and can't be permanently deleted. Keep it deactivated to preserve history."
      );
    }
    if (rooms > 0) {
      await prisma.roomType.deleteMany({ where: { hotelId: id } }); // cascades rooms
    }
    await prisma.hotel.delete({ where: { id } });
    await recordAudit({
      userId: actor.id,
      action: AuditActions.HOTEL_DELETED_PERMANENT,
      entity: "Hotel",
      entityId: id,
      metadata: { name: hotel.name, slug: hotel.slug },
    });
    return { id };
  },

  // ── Public website listing (curatdconcepts.com) ──────────────────────
  // One row per hotel, created on first save. See schema.prisma's
  // WebsiteListing doc comment for why this is separate from Hotel itself.

  async getWebsiteListing(actor: AuthenticatedUser, hotelId: string) {
    await this.get(hotelId);
    this.assertOwnHotel(actor, hotelId);
    const listing = await prisma.websiteListing.findUnique({ where: { hotelId } });
    // No row yet just means "never published" — return sensible defaults
    // rather than a 404, so the frontend can render the form either way.
    return (
      listing ?? {
        hotelId,
        isPublished: false,
        rating: null,
        reviewCount: 0,
        platformLinks: {},
      }
    );
  },

  async upsertWebsiteListing(actor: AuthenticatedUser, hotelId: string, data: any) {
    await this.get(hotelId);
    this.assertOwnHotel(actor, hotelId);

    const listing = await prisma.websiteListing.upsert({
      where: { hotelId },
      create: { hotelId, ...data },
      update: data,
    });

    await recordAudit({
      userId: actor.id,
      action: AuditActions.WEBSITE_LISTING_UPDATED,
      entity: "Hotel",
      entityId: hotelId,
      metadata: { changes: data },
    });

    return listing;
  },
};
