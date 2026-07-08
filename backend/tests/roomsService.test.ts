jest.mock("../src/config/database", () => ({
  prisma: {
    roomType: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
    room: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    bookingRoom: { findFirst: jest.fn(), findMany: jest.fn() },
    housekeepingTask: { create: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  },
}));

jest.mock("../src/config/redis", () => ({
  redis: {
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
  },
}));

import { prisma } from "../src/config/database";
import { redis } from "../src/config/redis";
import { roomsService } from "../src/modules/rooms/rooms.service";

const mockedPrisma = prisma as any;
const mockedRedis = redis as any;

const manager = { id: "mgr1", role: "MANAGER", hotelId: "hotelA" } as any;

beforeEach(() => jest.clearAllMocks());

describe("roomsService room types", () => {
  it("retires (soft-deletes) a room type that still has rooms instead of hard-deleting it", async () => {
    mockedPrisma.roomType.findFirst.mockResolvedValue({ id: "rt1", _count: { rooms: 3 } });
    mockedPrisma.roomType.update.mockResolvedValue({ id: "rt1", isActive: false });

    const result = await roomsService.deleteRoomType(manager, "hotelA", "rt1");

    expect(result).toEqual({ id: "rt1", retired: true });
    expect(mockedPrisma.roomType.delete).not.toHaveBeenCalled();
  });

  it("hard-deletes a room type with zero rooms", async () => {
    mockedPrisma.roomType.findFirst.mockResolvedValue({ id: "rt1", _count: { rooms: 0 } });
    mockedPrisma.roomType.delete.mockResolvedValue({ id: "rt1" });

    const result = await roomsService.deleteRoomType(manager, "hotelA", "rt1");

    expect(result).toEqual({ id: "rt1", retired: false });
    expect(mockedPrisma.roomType.delete).toHaveBeenCalled();
  });
});

describe("roomsService.createRoom", () => {
  it("rejects a room type that doesn't belong to this hotel", async () => {
    mockedPrisma.roomType.findFirst.mockResolvedValue(null);

    await expect(
      roomsService.createRoom(manager, "hotelA", { roomTypeId: "rt-other-hotel", roomNumber: "101", floor: 1 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a duplicate room number at the same hotel", async () => {
    mockedPrisma.roomType.findFirst.mockResolvedValue({ id: "rt1" });
    mockedPrisma.room.findFirst.mockResolvedValue({ id: "existing-room" });

    await expect(
      roomsService.createRoom(manager, "hotelA", { roomTypeId: "rt1", roomNumber: "101", floor: 1 })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("creates the room and writes an audit entry", async () => {
    mockedPrisma.roomType.findFirst.mockResolvedValue({ id: "rt1" });
    mockedPrisma.room.findFirst.mockResolvedValue(null);
    mockedPrisma.room.create.mockResolvedValue({ id: "room1", roomNumber: "101", floor: 1 });

    const result = await roomsService.createRoom(manager, "hotelA", { roomTypeId: "rt1", roomNumber: "101", floor: 1 });

    expect(result.id).toBe("room1");
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "PROPERTY_ROOM_CREATED" }) })
    );
  });
});

describe("roomsService.bulkCreateRooms", () => {
  it("skips room numbers that already exist and only creates the rest", async () => {
    mockedPrisma.roomType.findFirst.mockResolvedValue({ id: "rt1" });
    mockedPrisma.room.findMany.mockResolvedValue([{ roomNumber: "202" }]);
    mockedPrisma.room.create.mockImplementation(({ data }: any) => Promise.resolve({ id: `room-${data.roomNumber}`, ...data }));

    const result = await roomsService.bulkCreateRooms(manager, "hotelA", {
      roomTypeId: "rt1",
      floor: 2,
      startNumber: 201,
      count: 3,
    });

    expect(result.createdCount).toBe(2);
    expect(result.skipped).toEqual(["202"]);
  });

  it("rejects a batch count outside 1-200", async () => {
    mockedPrisma.roomType.findFirst.mockResolvedValue({ id: "rt1" });

    await expect(
      roomsService.bulkCreateRooms(manager, "hotelA", { roomTypeId: "rt1", floor: 2, startNumber: 1, count: 0 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("roomsService.deleteRoom", () => {
  it("refuses to delete an occupied room", async () => {
    mockedPrisma.room.findFirst.mockResolvedValue({ id: "room1", status: "OCCUPIED" });

    await expect(roomsService.deleteRoom(manager, "hotelA", "room1")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("refuses to delete a room with active/upcoming bookings", async () => {
    mockedPrisma.room.findFirst.mockResolvedValue({ id: "room1", status: "AVAILABLE" });
    mockedPrisma.bookingRoom.findFirst.mockResolvedValue({ id: "br1" });

    await expect(roomsService.deleteRoom(manager, "hotelA", "room1")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("deletes a clean room with no bookings", async () => {
    mockedPrisma.room.findFirst.mockResolvedValue({ id: "room1", status: "AVAILABLE", roomNumber: "101" });
    mockedPrisma.bookingRoom.findFirst.mockResolvedValue(null);
    mockedPrisma.room.delete.mockResolvedValue({ id: "room1" });

    const result = await roomsService.deleteRoom(manager, "hotelA", "room1");
    expect(result).toEqual({ id: "room1" });
  });
});

describe("roomsService.updateRoomStatus", () => {
  it("locks via Redis and releases the lock even if the update fails", async () => {
    mockedPrisma.room.findFirst.mockResolvedValue(null); // triggers notFound after lock acquired

    await expect(roomsService.updateRoomStatus(manager, "hotelA", "room1", "DIRTY" as any)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockedRedis.del).toHaveBeenCalledWith("lock:room:room1");
  });

  it("refuses concurrent updates to the same room", async () => {
    mockedRedis.set.mockResolvedValueOnce(null); // lock already held

    await expect(roomsService.updateRoomStatus(manager, "hotelA", "room1", "DIRTY" as any)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("enqueues a CHECKOUT_CLEAN housekeeping task when a room is marked DIRTY", async () => {
    mockedPrisma.room.findFirst.mockResolvedValue({ id: "room1", status: "OCCUPIED", roomNumber: "101" });
    mockedPrisma.room.update.mockResolvedValue({ id: "room1", status: "DIRTY", hotelId: "hotelA" });

    await roomsService.updateRoomStatus(manager, "hotelA", "room1", "DIRTY" as any);

    expect(mockedPrisma.housekeepingTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ roomId: "room1", type: "CHECKOUT_CLEAN" }) })
    );
  });
});

describe("roomsService.searchAvailability", () => {
  it("rejects a checkout date that isn't after check-in", async () => {
    await expect(
      roomsService.searchAvailability("hotelA", new Date("2026-08-10"), new Date("2026-08-09"))
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("excludes rooms with an overlapping active booking", async () => {
    mockedPrisma.roomType.findMany.mockResolvedValue([
      {
        id: "rt1",
        name: "Deluxe",
        maxOccupancy: 2,
        rooms: [
          { id: "room1", roomNumber: "101", floor: 1 },
          { id: "room2", roomNumber: "102", floor: 1 },
        ],
      },
    ]);
    mockedPrisma.bookingRoom.findMany.mockResolvedValue([{ roomId: "room1" }]);

    const result = await roomsService.searchAvailability("hotelA", new Date("2026-08-01"), new Date("2026-08-05"), 1);

    expect(result).toHaveLength(1);
    expect(result[0].availableRooms.map((r: any) => r.id)).toEqual(["room2"]);
  });
});
