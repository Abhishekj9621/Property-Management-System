jest.mock("../src/config/database", () => {
  const prisma: any = {
    bookingRoom: { findMany: jest.fn(), deleteMany: jest.fn() },
    room: { findMany: jest.fn(), updateMany: jest.fn() },
    guest: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    booking: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    housekeepingTask: { create: jest.fn() },
    invoice: { create: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return { prisma };
});

jest.mock("../src/config/redis", () => ({
  redis: {
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
  },
}));

import { prisma } from "../src/config/database";
import { redis } from "../src/config/redis";
import { bookingsService } from "../src/modules/bookings/bookings.service";

const mockedPrisma = prisma as any;
const mockedRedis = redis as any;

const roomType = { id: "rt1", basePrice: 2000, taxPercent: 10, discountPercent: 0 };
const room1 = { id: "room1", hotelId: "hotelA", roomTypeId: "rt1", roomType };
const room2 = { id: "room2", hotelId: "hotelA", roomTypeId: "rt1", roomType };

beforeEach(() => jest.clearAllMocks());

describe("bookingsService.createBooking", () => {
  it("rejects checkOutDate that isn't after checkInDate", async () => {
    await expect(
      bookingsService.createBooking("hotelA", "u1", {
        checkInDate: "2026-08-10",
        checkOutDate: "2026-08-09",
        adults: 1,
        children: 0,
        roomIds: ["room1"],
        source: "DIRECT",
        discountAmount: 0,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("refuses to proceed when a room lock is already held (concurrent booking attempt)", async () => {
    mockedRedis.set.mockResolvedValueOnce(null);

    await expect(
      bookingsService.createBooking("hotelA", "u1", {
        checkInDate: "2026-08-10",
        checkOutDate: "2026-08-12",
        adults: 1,
        children: 0,
        roomIds: ["room1"],
        source: "DIRECT",
        discountAmount: 0,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects when a selected room has an overlapping active booking", async () => {
    mockedPrisma.bookingRoom.findMany.mockResolvedValue([{ id: "br1", roomId: "room1" }]);

    await expect(
      bookingsService.createBooking("hotelA", "u1", {
        checkInDate: "2026-08-10",
        checkOutDate: "2026-08-12",
        adults: 1,
        children: 0,
        roomIds: ["room1"],
        source: "DIRECT",
        discountAmount: 0,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockedRedis.del).toHaveBeenCalled(); // lock released even on failure
  });

  it("prices two nights across two rooms, reserves the rooms, and audits the booking", async () => {
    mockedPrisma.bookingRoom.findMany.mockResolvedValue([]);
    mockedPrisma.room.findMany.mockResolvedValue([room1, room2]);
    mockedPrisma.guest.findFirst.mockResolvedValue({ id: "guest1" });
    mockedPrisma.booking.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "b1", bookingRef: data.bookingRef, ...data, guest: {}, hotel: {} })
    );

    const result = await bookingsService.createBooking("hotelA", "u1", {
      guestId: "guest1",
      checkInDate: "2026-08-10",
      checkOutDate: "2026-08-12", // 2 nights
      adults: 2,
      children: 0,
      roomIds: ["room1", "room2"],
      source: "DIRECT",
      discountAmount: 0,
    });

    // 2 rooms x 2 nights x 2000 = 8000 subtotal, +10% tax = 800 => 8800 total
    expect(result.totalAmount).toBe(8800);
    expect(result.taxAmount).toBe(800);
    expect(mockedPrisma.room.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["room1", "room2"] } }, data: { status: "RESERVED" } })
    );
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "RESERVATION_BOOKING_CREATED" }) })
    );
    expect(mockedRedis.del).toHaveBeenCalled();
  });
});

describe("bookingsService status transitions", () => {
  const confirmedBooking = {
    id: "b1",
    hotelId: "hotelA",
    status: "CONFIRMED",
    bookingRef: "NV-1",
    guestId: "guest1",
    guest: { id: "guest1", loyaltyPoints: 100, loyaltyTier: "BRONZE" },
    hotel: {},
    rooms: [{ roomId: "room1" }],
    totalAmount: 4400,
    taxAmount: 400,
    discountAmount: 0,
  };

  it("refuses check-in on a booking that isn't CONFIRMED", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ ...confirmedBooking, status: "CANCELLED" });

    await expect(bookingsService.checkIn("hotelA", "b1")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("checks in a CONFIRMED booking and occupies its rooms", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue(confirmedBooking);
    mockedPrisma.booking.update.mockResolvedValue({ id: "b1", status: "CHECKED_IN" });

    const result = await bookingsService.checkIn("hotelA", "b1", "staff1");

    expect(result.status).toBe("CHECKED_IN");
    expect(mockedPrisma.room.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "OCCUPIED" } })
    );
  });

  it("refuses checkout on a booking that isn't CHECKED_IN", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ ...confirmedBooking, status: "CONFIRMED" });

    await expect(bookingsService.checkOut("hotelA", "b1")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("checks out, generates an invoice, marks rooms DIRTY, and awards loyalty points", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ ...confirmedBooking, status: "CHECKED_IN" });
    mockedPrisma.booking.update.mockResolvedValue({ id: "b1", status: "CHECKED_OUT" });
    mockedPrisma.guest.update.mockResolvedValue({ id: "guest1", loyaltyPoints: 144, loyaltyTier: "BRONZE" });

    const result = await bookingsService.checkOut("hotelA", "b1", "staff1");

    expect(mockedPrisma.invoice.create).toHaveBeenCalled();
    expect(mockedPrisma.housekeepingTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "CHECKOUT_CLEAN" }) })
    );
    expect(result.loyaltyPointsEarned).toBe(44); // floor(4400 / 100)
  });

  it("refuses a status change on a booking that's already CHECKED_OUT or CANCELLED", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ ...confirmedBooking, status: "CHECKED_OUT" });

    await expect(bookingsService.updateStatus("hotelA", "b1", "CANCELLED" as any)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("releases reserved rooms back to AVAILABLE when cancelling", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue(confirmedBooking);
    mockedPrisma.booking.update.mockResolvedValue({ id: "b1", status: "CANCELLED" });

    await bookingsService.updateStatus("hotelA", "b1", "CANCELLED" as any, "Guest requested", "staff1");

    expect(mockedPrisma.room.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["room1"] }, status: "RESERVED" }, data: { status: "AVAILABLE" } })
    );
  });
});

describe("bookingsService.amendBooking", () => {
  const pendingBooking = {
    id: "b1",
    hotelId: "hotelA",
    status: "CONFIRMED",
    bookingRef: "NV-1",
    checkInDate: new Date("2026-08-10"),
    checkOutDate: new Date("2026-08-12"),
    adults: 1,
    children: 0,
    discountAmount: 0,
    specialRequests: undefined,
    guest: {},
    hotel: {},
    rooms: [{ roomId: "room1" }],
  };

  it("refuses to amend a CHECKED_IN or later booking", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ ...pendingBooking, status: "CHECKED_IN" });

    await expect(bookingsService.amendBooking("hotelA", "b1", { adults: 2 })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("rejects a new checkout date that isn't after the new check-in date", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue(pendingBooking);

    await expect(
      bookingsService.amendBooking("hotelA", "b1", { checkInDate: "2026-08-15", checkOutDate: "2026-08-14" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("swaps rooms, releasing the old one and reserving the new one, and audits the change", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue(pendingBooking);
    mockedPrisma.bookingRoom.findMany.mockResolvedValue([]); // no conflicts on the new room
    mockedPrisma.room.findMany.mockResolvedValue([room2]);
    mockedPrisma.booking.update.mockResolvedValue({ id: "b1", rooms: [{ roomId: "room2" }] });

    await bookingsService.amendBooking("hotelA", "b1", { roomIds: ["room2"] }, "staff1");

    expect(mockedPrisma.bookingRoom.deleteMany).toHaveBeenCalledWith({ where: { bookingId: "b1" } });
    expect(mockedPrisma.room.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["room1"] }, status: "RESERVED" }, data: { status: "AVAILABLE" } })
    );
    expect(mockedPrisma.room.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["room2"] } }, data: { status: "RESERVED" } })
    );
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "RESERVATION_BOOKING_AMENDED" }) })
    );
  });
});

describe("bookingsService.deleteBooking", () => {
  it("refuses to delete a CONFIRMED booking", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ id: "b1", status: "CONFIRMED", payments: [], paidAmount: 0 });

    await expect(bookingsService.deleteBooking("hotelA", "b1")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("refuses to delete a booking with recorded payments even if PENDING", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({
      id: "b1",
      status: "PENDING",
      payments: [{ id: "p1" }],
      paidAmount: 500,
    });

    await expect(bookingsService.deleteBooking("hotelA", "b1")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("deletes a PENDING booking with no payments and releases its rooms", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({
      id: "b1",
      status: "PENDING",
      bookingRef: "NV-1",
      payments: [],
      paidAmount: 0,
    });
    mockedPrisma.bookingRoom.findMany.mockResolvedValue([{ roomId: "room1" }]);

    const result = await bookingsService.deleteBooking("hotelA", "b1", "staff1");

    expect(result).toEqual({ id: "b1" });
    expect(mockedPrisma.booking.delete).toHaveBeenCalledWith({ where: { id: "b1" } });
  });
});

describe("bookingsService.sweepNoShows", () => {
  it("flips overdue CONFIRMED bookings to NO_SHOW and releases their rooms", async () => {
    const overdueBooking = {
      id: "b1",
      hotelId: "hotelA",
      bookingRef: "NV-1",
      status: "CONFIRMED",
      checkInDate: new Date("2020-01-01"),
      rooms: [{ roomId: "room1" }],
      guest: {},
    };
    mockedPrisma.booking.findMany.mockResolvedValue([overdueBooking]);

    const flipped = await bookingsService.sweepNoShows(new Date("2026-08-01"));

    expect(flipped).toHaveLength(1);
    expect(mockedPrisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "b1" }, data: expect.objectContaining({ status: "NO_SHOW" }) })
    );
    expect(mockedPrisma.room.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["room1"] }, status: "RESERVED" }, data: { status: "AVAILABLE" } })
    );
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "RESERVATION_BOOKING_NO_SHOW_AUTO" }) })
    );
  });

  it("does nothing when there are no overdue bookings", async () => {
    mockedPrisma.booking.findMany.mockResolvedValue([]);

    const flipped = await bookingsService.sweepNoShows(new Date("2026-08-01"));

    expect(flipped).toHaveLength(0);
    expect(mockedPrisma.booking.update).not.toHaveBeenCalled();
  });
});
