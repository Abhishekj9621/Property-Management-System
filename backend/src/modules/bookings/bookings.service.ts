import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import { ApiError } from "../../utils/ApiError";
import { recordAudit, AuditActions } from "../../lib/auditLog";
import { BookingStatus, Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function generateBookingRef(): string {
  return `NV-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;
}

/** Per-line pricing using each room's own room-type base price, tax %, and discount % (configured on Rooms & Pricing). */
function priceRooms(rooms: { roomType: { basePrice: any; taxPercent: any; discountPercent: any } }[], nights: number, extraDiscount = 0) {
  let subtotal = 0;
  let taxAmount = 0;
  let lineDiscount = 0;
  for (const r of rooms) {
    const lineBase = Number(r.roomType.basePrice) * nights;
    const lineTax = lineBase * (Number(r.roomType.taxPercent ?? 0) / 100);
    const lineDisc = lineBase * (Number(r.roomType.discountPercent ?? 0) / 100);
    subtotal += lineBase;
    taxAmount += lineTax;
    lineDiscount += lineDisc;
  }
  taxAmount = Number(taxAmount.toFixed(2));
  const totalDiscount = Number((lineDiscount + extraDiscount).toFixed(2));
  const totalAmount = Number((subtotal + taxAmount - totalDiscount).toFixed(2));
  return { subtotal, taxAmount, totalDiscount, totalAmount };
}

interface CreateBookingInput {
  guestId?: string;
  guest?: { firstName: string; lastName: string; email: string; phone: string };
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  roomIds: string[];
  specialRequests?: string;
  source: string;
  discountAmount: number;
}

interface AmendBookingInput {
  checkInDate?: string;
  checkOutDate?: string;
  roomIds?: string[];
  adults?: number;
  children?: number;
  specialRequests?: string;
  discountAmount?: number;
}

export const bookingsService = {
  /**
   * Creates a booking atomically:
   *  1. Re-validates room availability inside the DB transaction (prevents
   *     double-booking race conditions between the initial search and submit).
   *  2. Upserts the guest record.
   *  3. Computes pricing from each room's room-type base price x nights.
   *  4. Persists Booking + BookingRoom line items.
   *  5. Flags rooms RESERVED.
   */
  async createBooking(hotelId: string, createdById: string | undefined, input: CreateBookingInput) {
    const checkInDate = new Date(input.checkInDate);
    const checkOutDate = new Date(input.checkOutDate);
    if (checkInDate >= checkOutDate) throw ApiError.badRequest("checkOutDate must be after checkInDate");

    const nights = nightsBetween(checkInDate, checkOutDate);

    // Distributed lock per room to avoid concurrent double-booking during the transaction
    const lockKeys = input.roomIds.map((id) => `lock:room:${id}`);
    const locksAcquired: string[] = [];
    try {
      for (const key of lockKeys) {
        const ok = await redis.set(key, "1", "EX", 10, "NX");
        if (!ok) throw ApiError.conflict("One or more selected rooms are currently being booked. Please retry.");
        locksAcquired.push(key);
      }

      const booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Re-check availability inside transaction
        const conflicting = await tx.bookingRoom.findMany({
          where: {
            roomId: { in: input.roomIds },
            booking: {
              status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
              checkInDate: { lt: checkOutDate },
              checkOutDate: { gt: checkInDate },
            },
          },
        });
        if (conflicting.length > 0) {
          throw ApiError.conflict("One or more selected rooms are no longer available for these dates");
        }

        const rooms = await tx.room.findMany({
          where: { id: { in: input.roomIds }, hotelId },
          include: { roomType: true },
        });
        if (rooms.length !== input.roomIds.length) {
          throw ApiError.badRequest("One or more rooms are invalid for this hotel");
        }

        // Resolve / create guest
        let guestId = input.guestId;
        if (!guestId && input.guest) {
          const existingGuest = await tx.guest.findFirst({
            where: { hotelId, email: input.guest.email },
          });
          guestId = existingGuest
            ? existingGuest.id
            : (
                await tx.guest.create({
                  data: { hotelId, ...input.guest },
                })
              ).id;
        }
        if (!guestId) throw ApiError.badRequest("guestId or guest details are required");

        const { taxAmount, totalDiscount, totalAmount } = priceRooms(rooms, nights, input.discountAmount);

        const created = await tx.booking.create({
          data: {
            bookingRef: generateBookingRef(),
            hotelId,
            guestId,
            checkInDate,
            checkOutDate,
            adults: input.adults,
            children: input.children,
            totalAmount,
            taxAmount,
            discountAmount: totalDiscount,
            source: input.source,
            specialRequests: input.specialRequests,
            createdById,
            status: "CONFIRMED",
            rooms: {
              create: rooms.map((r) => ({
                roomId: r.id,
                roomTypeId: r.roomTypeId,
                pricePerNight: r.roomType.basePrice,
                nights,
              })),
            },
          },
          include: { rooms: { include: { room: true, roomType: true } }, guest: true, hotel: true },
        });

        await tx.room.updateMany({
          where: { id: { in: input.roomIds } },
          data: { status: "RESERVED" },
        });

        return created;
      });

      await recordAudit({
        userId: createdById ?? null,
        action: AuditActions.BOOKING_CREATED,
        entity: "Booking",
        entityId: booking.id,
        metadata: { hotelId, bookingRef: booking.bookingRef, roomIds: input.roomIds, totalAmount: booking.totalAmount },
      });

      return booking;
    } finally {
      if (locksAcquired.length) await redis.del(...locksAcquired);
    }
  },

  async listBookings(
    hotelId: string,
    filters: { status?: BookingStatus; from?: string; to?: string; page?: number; limit?: number }
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const where = {
      hotelId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from || filters.to
        ? {
            checkInDate: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { guest: true, rooms: { include: { room: true, roomType: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getBooking(hotelId: string, id: string) {
    const booking = await prisma.booking.findFirst({
      where: { id, hotelId },
      include: {
        guest: true,
        hotel: true,
        rooms: { include: { room: true, roomType: true } },
        payments: true,
        invoice: true,
      },
    });
    if (!booking) throw ApiError.notFound("Booking not found");
    return booking;
  },

  async checkIn(hotelId: string, id: string, actorId?: string) {
    const booking = await this.getBooking(hotelId, id);
    if (booking.status !== "CONFIRMED") {
      throw ApiError.badRequest(`Cannot check in a booking with status ${booking.status}`);
    }

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.booking.update({
        where: { id },
        data: { status: "CHECKED_IN", actualCheckIn: new Date() },
      });
      await tx.room.updateMany({
        where: { id: { in: booking.rooms.map((r) => r.roomId) } },
        data: { status: "OCCUPIED" },
      });
      return result;
    });

    await recordAudit({
      userId: actorId ?? null,
      action: AuditActions.BOOKING_CHECKED_IN,
      entity: "Booking",
      entityId: id,
      metadata: { hotelId, bookingRef: booking.bookingRef },
    });

    return { ...updated, guest: booking.guest, hotel: booking.hotel };
  },

  async checkOut(hotelId: string, id: string, actorId?: string) {
    const booking = await this.getBooking(hotelId, id);
    if (booking.status !== "CHECKED_IN") {
      throw ApiError.badRequest(`Cannot check out a booking with status ${booking.status}`);
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.booking.update({
        where: { id },
        data: { status: "CHECKED_OUT", actualCheckOut: new Date() },
      });

      // Rooms become DIRTY, which (via rooms service logic) implies a
      // housekeeping task; replicate that here since we're inside a tx.
      await tx.room.updateMany({
        where: { id: { in: booking.rooms.map((r) => r.roomId) } },
        data: { status: "DIRTY" },
      });
      for (const br of booking.rooms) {
        await tx.housekeepingTask.create({
          data: { roomId: br.roomId, type: "CHECKOUT_CLEAN", status: "PENDING", priority: 2 },
        });
      }

      // Generate invoice
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      await tx.invoice.create({
        data: {
          hotelId: booking.hotelId,
          bookingId: id,
          guestId: booking.guestId,
          invoiceNumber,
          subtotal: Number(booking.totalAmount) - Number(booking.taxAmount) + Number(booking.discountAmount),
          tax: booking.taxAmount,
          discount: booking.discountAmount,
          total: booking.totalAmount,
        },
      });

      // Loyalty: 1 point per ₹100 spent, plus tier upgrades.
      const pointsEarned = Math.floor(Number(booking.totalAmount) / 100);
      const guest = await tx.guest.update({
        where: { id: booking.guestId },
        data: { loyaltyPoints: { increment: pointsEarned } },
      });
      const tier =
        guest.loyaltyPoints >= 5000
          ? "PLATINUM"
          : guest.loyaltyPoints >= 2000
            ? "GOLD"
            : guest.loyaltyPoints >= 500
              ? "SILVER"
              : "BRONZE";
      if (tier !== guest.loyaltyTier) {
        await tx.guest.update({ where: { id: booking.guestId }, data: { loyaltyTier: tier } });
      }

      return { ...updated, guest: booking.guest, hotel: booking.hotel, loyaltyPointsEarned: pointsEarned };
    });

    await recordAudit({
      userId: actorId ?? null,
      action: AuditActions.BOOKING_CHECKED_OUT,
      entity: "Booking",
      entityId: id,
      metadata: { hotelId, bookingRef: booking.bookingRef, loyaltyPointsEarned: result.loyaltyPointsEarned },
    });

    return result;
  },

  async updateStatus(hotelId: string, id: string, status: BookingStatus, cancellationReason?: string, actorId?: string) {
    if (status === "CHECKED_IN") return this.checkIn(hotelId, id, actorId);
    if (status === "CHECKED_OUT") return this.checkOut(hotelId, id, actorId);

    const booking = await this.getBooking(hotelId, id);
    if (booking.status === "CHECKED_OUT" || booking.status === "CANCELLED") {
      throw ApiError.badRequest(`Cannot change status of a booking that is already ${booking.status}`);
    }

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.booking.update({
        where: { id },
        data: { status, cancellationReason },
      });

      if (status === "CANCELLED" || status === "NO_SHOW") {
        await tx.room.updateMany({
          where: { id: { in: booking.rooms.map((r) => r.roomId) }, status: "RESERVED" },
          data: { status: "AVAILABLE" },
        });
      }

      return result;
    });

    await recordAudit({
      userId: actorId ?? null,
      action:
        status === "CANCELLED"
          ? AuditActions.BOOKING_CANCELLED
          : status === "NO_SHOW"
            ? AuditActions.BOOKING_NO_SHOW
            : AuditActions.BOOKING_STATUS_CHANGED,
      entity: "Booking",
      entityId: id,
      metadata: { hotelId, bookingRef: booking.bookingRef, previousStatus: booking.status, newStatus: status, cancellationReason },
    });

    return { ...updated, guest: booking.guest, hotel: booking.hotel };
  },

  /**
   * Amends a not-yet-checked-in reservation: dates, rooms, occupancy,
   * special requests, and/or the manual discount. Re-validates availability
   * for the *new* room/date combination (excluding this booking's own
   * current rows) inside a transaction, re-prices the stay from scratch,
   * and swaps the BookingRoom line items — releasing rooms that are no
   * longer part of the reservation and reserving any newly-added ones.
   * Amending a CHECKED_IN stay (a mid-stay room move / stay extension) is
   * out of scope here; front desk should check the guest out and create a
   * new reservation, or this can be added as its own workflow later.
   */
  async amendBooking(hotelId: string, id: string, input: AmendBookingInput, actorId?: string) {
    const booking = await this.getBooking(hotelId, id);
    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      throw ApiError.conflict(`A ${booking.status} booking can't be amended. Only PENDING or CONFIRMED bookings can be changed before check-in.`);
    }

    const checkInDate = input.checkInDate ? new Date(input.checkInDate) : booking.checkInDate;
    const checkOutDate = input.checkOutDate ? new Date(input.checkOutDate) : booking.checkOutDate;
    if (checkInDate >= checkOutDate) throw ApiError.badRequest("checkOutDate must be after checkInDate");

    const roomIds = input.roomIds ?? booking.rooms.map((r) => r.roomId);
    const nights = nightsBetween(checkInDate, checkOutDate);

    const lockKeys = roomIds.map((rid) => `lock:room:${rid}`);
    const locksAcquired: string[] = [];
    try {
      for (const key of lockKeys) {
        const ok = await redis.set(key, "1", "EX", 10, "NX");
        if (!ok) throw ApiError.conflict("One or more selected rooms are currently being booked. Please retry.");
        locksAcquired.push(key);
      }

      const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const conflicting = await tx.bookingRoom.findMany({
          where: {
            roomId: { in: roomIds },
            bookingId: { not: id },
            booking: {
              status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
              checkInDate: { lt: checkOutDate },
              checkOutDate: { gt: checkInDate },
            },
          },
        });
        if (conflicting.length > 0) {
          throw ApiError.conflict("One or more selected rooms are not available for the new dates");
        }

        const rooms = await tx.room.findMany({ where: { id: { in: roomIds }, hotelId }, include: { roomType: true } });
        if (rooms.length !== roomIds.length) throw ApiError.badRequest("One or more rooms are invalid for this hotel");

        const { taxAmount, totalDiscount, totalAmount } = priceRooms(rooms, nights, input.discountAmount ?? 0);

        const previousRoomIds = booking.rooms.map((r) => r.roomId);

        await tx.bookingRoom.deleteMany({ where: { bookingId: id } });
        const result = await tx.booking.update({
          where: { id },
          data: {
            checkInDate,
            checkOutDate,
            adults: input.adults ?? booking.adults,
            children: input.children ?? booking.children,
            specialRequests: input.specialRequests ?? booking.specialRequests,
            totalAmount,
            taxAmount,
            discountAmount: totalDiscount,
            rooms: {
              create: rooms.map((r) => ({
                roomId: r.id,
                roomTypeId: r.roomTypeId,
                pricePerNight: r.roomType.basePrice,
                nights,
              })),
            },
          },
          include: { rooms: { include: { room: true, roomType: true } }, guest: true, hotel: true },
        });

        const releasedRoomIds = previousRoomIds.filter((rid) => !roomIds.includes(rid));
        if (releasedRoomIds.length) {
          await tx.room.updateMany({ where: { id: { in: releasedRoomIds }, status: "RESERVED" }, data: { status: "AVAILABLE" } });
        }
        const newlyAddedRoomIds = roomIds.filter((rid) => !previousRoomIds.includes(rid));
        if (newlyAddedRoomIds.length) {
          await tx.room.updateMany({ where: { id: { in: newlyAddedRoomIds } }, data: { status: "RESERVED" } });
        }

        return result;
      });

      await recordAudit({
        userId: actorId ?? null,
        action: AuditActions.BOOKING_AMENDED,
        entity: "Booking",
        entityId: id,
        metadata: {
          hotelId,
          bookingRef: booking.bookingRef,
          previous: { checkInDate: booking.checkInDate, checkOutDate: booking.checkOutDate, roomIds: booking.rooms.map((r) => r.roomId) },
          updated: { checkInDate, checkOutDate, roomIds },
        },
      });

      return updated;
    } finally {
      if (locksAcquired.length) await redis.del(...locksAcquired);
    }
  },

  // Bookings are financial/audit records, so only PENDING or already-CANCELLED
  // bookings with no recorded payments can be hard-deleted (e.g. to clean up
  // a mistaken entry). Anything further along must be cancelled instead,
  // which preserves the record for reporting and guest history.
  async deleteBooking(hotelId: string, id: string, actorId?: string) {
    const booking = await prisma.booking.findFirst({
      where: { id, hotelId },
      include: { payments: true },
    });
    if (!booking) throw ApiError.notFound("Booking not found");

    if (!["PENDING", "CANCELLED"].includes(booking.status)) {
      throw ApiError.conflict("Only pending or cancelled bookings can be deleted. Cancel this booking first.");
    }
    if (booking.payments.length > 0 || Number(booking.paidAmount) > 0) {
      throw ApiError.conflict("This booking has recorded payments and can't be deleted.");
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.room.updateMany({
        where: {
          id: { in: (await tx.bookingRoom.findMany({ where: { bookingId: id } })).map((r) => r.roomId) },
          status: "RESERVED",
        },
        data: { status: "AVAILABLE" },
      });
      await tx.booking.delete({ where: { id } });
    });

    await recordAudit({
      userId: actorId ?? null,
      action: AuditActions.BOOKING_DELETED,
      entity: "Booking",
      entityId: id,
      metadata: { hotelId, bookingRef: booking.bookingRef },
    });

    return { id };
  },

  /**
   * Background sweep (run by the no-show BullMQ worker): any CONFIRMED
   * booking whose check-in date has fully elapsed without the guest
   * checking in is marked NO_SHOW and its reserved rooms are released back
   * to AVAILABLE. Runs across all hotels in one pass. Returns the list of
   * bookings it flipped, so the worker can log/notify per hotel.
   */
  async sweepNoShows(now: Date = new Date()) {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const overdue = await prisma.booking.findMany({
      where: { status: "CONFIRMED", checkInDate: { lt: startOfToday } },
      include: { rooms: true, guest: true },
    });

    const flipped = [];
    for (const booking of overdue) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: "NO_SHOW", cancellationReason: "Automatically marked as no-show: guest did not check in" },
        });
        await tx.room.updateMany({
          where: { id: { in: booking.rooms.map((r) => r.roomId) }, status: "RESERVED" },
          data: { status: "AVAILABLE" },
        });
      });

      await recordAudit({
        userId: null,
        action: AuditActions.BOOKING_NO_SHOW_AUTO,
        entity: "Booking",
        entityId: booking.id,
        metadata: { hotelId: booking.hotelId, bookingRef: booking.bookingRef, checkInDate: booking.checkInDate },
      });

      flipped.push(booking);
    }

    return flipped;
  },
};
