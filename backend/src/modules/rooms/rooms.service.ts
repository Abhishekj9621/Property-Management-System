import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import { ApiError } from "../../utils/ApiError";
import { AuthenticatedUser } from "../../middlewares/auth.middleware";
import { recordAudit, AuditActions } from "../../lib/auditLog";
import { RoomStatus } from "@prisma/client";

export const roomsService = {
  // ---------- Room Types ----------
  async createRoomType(actor: AuthenticatedUser, hotelId: string, data: any) {
    const created = await prisma.roomType.create({ data: { ...data, hotelId }, include: { category: true } });
    await recordAudit({
      userId: actor.id,
      action: AuditActions.ROOM_TYPE_CREATED,
      entity: "RoomType",
      entityId: created.id,
      metadata: { hotelId, name: created.name, basePrice: created.basePrice },
    });
    return created;
  },

  async listRoomTypes(hotelId: string, includeInactive = false) {
    return prisma.roomType.findMany({
      where: { hotelId, ...(includeInactive ? {} : { isActive: true }) },
      include: { category: true },
      orderBy: { basePrice: "asc" },
    });
  },

  async updateRoomType(actor: AuthenticatedUser, hotelId: string, id: string, data: any) {
    const roomType = await prisma.roomType.findFirst({ where: { id, hotelId } });
    if (!roomType) throw ApiError.notFound("Room type not found");
    const updated = await prisma.roomType.update({ where: { id }, data, include: { category: true } });
    await recordAudit({
      userId: actor.id,
      action: AuditActions.ROOM_TYPE_UPDATED,
      entity: "RoomType",
      entityId: id,
      metadata: { hotelId, changes: data },
    });
    return updated;
  },

  async deleteRoomType(actor: AuthenticatedUser, hotelId: string, id: string) {
    const roomType = await prisma.roomType.findFirst({
      where: { id, hotelId },
      include: { _count: { select: { rooms: true } } },
    });
    if (!roomType) throw ApiError.notFound("Room type not found");
    let result;
    if (roomType._count.rooms > 0) {
      // Rooms still reference this type, so hard-deleting would orphan them.
      // Retire it instead: it disappears from "create room" pickers but
      // existing rooms/booking history stay intact.
      await prisma.roomType.update({ where: { id }, data: { isActive: false } });
      result = { id, retired: true };
    } else {
      await prisma.roomType.delete({ where: { id } });
      result = { id, retired: false };
    }
    await recordAudit({
      userId: actor.id,
      action: AuditActions.ROOM_TYPE_DELETED,
      entity: "RoomType",
      entityId: id,
      metadata: { hotelId, retired: result.retired },
    });
    return result;
  },

  // ---------- Rooms ----------
  async createRoom(actor: AuthenticatedUser, hotelId: string, data: any) {
    const roomType = await prisma.roomType.findFirst({ where: { id: data.roomTypeId, hotelId } });
    if (!roomType) throw ApiError.badRequest("Invalid room type for this hotel");
    const existing = await prisma.room.findFirst({ where: { hotelId, roomNumber: data.roomNumber } });
    if (existing) throw ApiError.conflict(`Room ${data.roomNumber} already exists at this property`);
    const created = await prisma.room.create({ data: { ...data, hotelId }, include: { roomType: true } });
    await recordAudit({
      userId: actor.id,
      action: AuditActions.ROOM_CREATED,
      entity: "Room",
      entityId: created.id,
      metadata: { hotelId, roomNumber: created.roomNumber, floor: created.floor },
    });
    return created;
  },

  /**
   * Bulk-provisions a contiguous range of rooms of the same type/floor in one
   * call — the common "set up floor 4 with rooms 401-420" onboarding workflow,
   * instead of forcing an admin to submit the create-room form one at a time.
   * Skips (and reports) any room numbers that already exist rather than
   * failing the whole batch.
   */
  async bulkCreateRooms(
    actor: AuthenticatedUser,
    hotelId: string,
    data: {
      roomTypeId: string;
      floor: number;
      startNumber: number;
      count: number;
      prefix?: string;
      view?: string;
      smokingAllowed?: boolean;
    }
  ) {
    const roomType = await prisma.roomType.findFirst({ where: { id: data.roomTypeId, hotelId } });
    if (!roomType) throw ApiError.badRequest("Invalid room type for this hotel");
    if (data.count < 1 || data.count > 200) {
      throw ApiError.badRequest("count must be between 1 and 200 rooms per batch");
    }

    const candidateNumbers = Array.from({ length: data.count }, (_, i) =>
      `${data.prefix ?? ""}${data.startNumber + i}`
    );

    const existingRooms = await prisma.room.findMany({
      where: { hotelId, roomNumber: { in: candidateNumbers } },
      select: { roomNumber: true },
    });
    const existingSet = new Set(existingRooms.map((r) => r.roomNumber));
    const toCreate = candidateNumbers.filter((n) => !existingSet.has(n));

    const created = await prisma.$transaction(
      toCreate.map((roomNumber) =>
        prisma.room.create({
          data: {
            hotelId,
            roomTypeId: data.roomTypeId,
            roomNumber,
            floor: data.floor,
            view: data.view,
            smokingAllowed: data.smokingAllowed ?? false,
          },
        })
      )
    );

    await recordAudit({
      userId: actor.id,
      action: AuditActions.ROOMS_BULK_CREATED,
      entity: "Room",
      metadata: { hotelId, floor: data.floor, createdCount: created.length, skipped: candidateNumbers.filter((n) => existingSet.has(n)) },
    });

    return {
      created,
      createdCount: created.length,
      skipped: candidateNumbers.filter((n) => existingSet.has(n)),
    };
  },

  async updateRoom(actor: AuthenticatedUser, hotelId: string, id: string, data: any) {
    const room = await prisma.room.findFirst({ where: { id, hotelId } });
    if (!room) throw ApiError.notFound("Room not found");
    if (data.roomTypeId) {
      const roomType = await prisma.roomType.findFirst({ where: { id: data.roomTypeId, hotelId } });
      if (!roomType) throw ApiError.badRequest("Invalid room type for this hotel");
    }
    const updated = await prisma.room.update({ where: { id }, data, include: { roomType: true } });
    await recordAudit({
      userId: actor.id,
      action: AuditActions.ROOM_UPDATED,
      entity: "Room",
      entityId: id,
      metadata: { hotelId, changes: data },
    });
    return updated;
  },

  async listRooms(hotelId: string, filters: { status?: RoomStatus; roomTypeId?: string; floor?: number }) {
    return prisma.room.findMany({
      where: {
        hotelId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.roomTypeId ? { roomTypeId: filters.roomTypeId } : {}),
        ...(filters.floor !== undefined ? { floor: filters.floor } : {}),
      },
      include: { roomType: true },
      orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
    });
  },

  /** Distinct floors at a property with a room-count and status breakdown per floor — powers a floor-plan / building overview view. */
  async listFloors(hotelId: string) {
    const rooms = await prisma.room.findMany({
      where: { hotelId },
      select: { floor: true, status: true },
    });
    const byFloor = new Map<number, { floor: number; totalRooms: number; statusCounts: Record<string, number> }>();
    for (const r of rooms) {
      if (!byFloor.has(r.floor)) {
        byFloor.set(r.floor, { floor: r.floor, totalRooms: 0, statusCounts: {} });
      }
      const entry = byFloor.get(r.floor)!;
      entry.totalRooms += 1;
      entry.statusCounts[r.status] = (entry.statusCounts[r.status] ?? 0) + 1;
    }
    return Array.from(byFloor.values()).sort((a, b) => a.floor - b.floor);
  },

  async getRoom(hotelId: string, id: string) {
    const room = await prisma.room.findFirst({ where: { id, hotelId }, include: { roomType: true } });
    if (!room) throw ApiError.notFound("Room not found");
    return room;
  },

  async deleteRoom(actor: AuthenticatedUser, hotelId: string, id: string) {
    const room = await prisma.room.findFirst({ where: { id, hotelId } });
    if (!room) throw ApiError.notFound("Room not found");
    if (room.status === "OCCUPIED" || room.status === "RESERVED") {
      throw ApiError.conflict("This room is occupied or reserved and can't be deleted.");
    }

    const activeBooking = await prisma.bookingRoom.findFirst({
      where: {
        roomId: id,
        booking: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
      },
    });
    if (activeBooking) {
      throw ApiError.conflict("This room has active or upcoming bookings and can't be deleted.");
    }

    await prisma.room.delete({ where: { id } });
    await recordAudit({
      userId: actor.id,
      action: AuditActions.ROOM_DELETED,
      entity: "Room",
      entityId: id,
      metadata: { hotelId, roomNumber: room.roomNumber },
    });
    return { id };
  },

  /**
   * Transitions a room's status. Certain transitions automatically enqueue
   * housekeeping tasks (e.g. OCCUPIED -> DIRTY on checkout triggers a
   * CHECKOUT_CLEAN task). Uses a short Redis lock to avoid racing status
   * writes from concurrent front-desk / housekeeping actions on the same room.
   */
  async updateRoomStatus(actor: AuthenticatedUser, hotelId: string, id: string, status: RoomStatus) {
    const lockKey = `lock:room:${id}`;
    const acquired = await redis.set(lockKey, "1", "EX", 5, "NX");
    if (!acquired) throw ApiError.conflict("Room is currently being updated, try again shortly");

    try {
      const room = await prisma.room.findFirst({ where: { id, hotelId } });
      if (!room) throw ApiError.notFound("Room not found");
      const previousStatus = room.status;

      const updated = await prisma.room.update({ where: { id }, data: { status } });

      if (status === "DIRTY") {
        await prisma.housekeepingTask.create({
          data: { roomId: id, type: "CHECKOUT_CLEAN", status: "PENDING", priority: 2 },
        });
      }

      await recordAudit({
        userId: actor.id,
        action: AuditActions.ROOM_STATUS_CHANGED,
        entity: "Room",
        entityId: id,
        metadata: { hotelId, roomNumber: room.roomNumber, previousStatus, newStatus: status },
      });

      return updated;
    } finally {
      await redis.del(lockKey);
    }
  },

  /**
   * Core availability search: finds rooms of each type that have NO
   * overlapping active booking within [checkInDate, checkOutDate).
   * Overlap rule: existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn
   */
  async searchAvailability(hotelId: string, checkInDate: Date, checkOutDate: Date, adults = 1) {
    if (checkInDate >= checkOutDate) {
      throw ApiError.badRequest("checkOutDate must be after checkInDate");
    }

    const roomTypes = await prisma.roomType.findMany({
      where: { hotelId, maxOccupancy: { gte: adults } },
      include: {
        rooms: {
          where: { hotelId, status: { not: "OUT_OF_SERVICE" } },
        },
      },
    });

    const results = [];
    for (const rt of roomTypes) {
      const roomIds = rt.rooms.map((r) => r.id);
      if (roomIds.length === 0) continue;

      const overlappingBookings = await prisma.bookingRoom.findMany({
        where: {
          roomId: { in: roomIds },
          booking: {
            status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
            checkInDate: { lt: checkOutDate },
            checkOutDate: { gt: checkInDate },
          },
        },
        select: { roomId: true },
      });

      const bookedRoomIds = new Set(overlappingBookings.map((b) => b.roomId));
      const availableRooms = rt.rooms.filter((r) => !bookedRoomIds.has(r.id));

      if (availableRooms.length > 0) {
        results.push({
          roomType: {
            id: rt.id,
            name: rt.name,
            description: rt.description,
            basePrice: rt.basePrice,
            weekendPrice: rt.weekendPrice,
            extraBedPrice: rt.extraBedPrice,
            taxPercent: rt.taxPercent,
            discountPercent: rt.discountPercent,
            minOccupancy: rt.minOccupancy,
            maxOccupancy: rt.maxOccupancy,
            amenities: rt.amenities,
            images: rt.images,
          },
          availableCount: availableRooms.length,
          availableRooms: availableRooms.map((r) => ({ id: r.id, roomNumber: r.roomNumber, floor: r.floor })),
        });
      }
    }

    return results;
  },
};
