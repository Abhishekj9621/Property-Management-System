jest.mock("../src/config/database", () => ({
  prisma: {
    hotel: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    hotelType: { findUnique: jest.fn() },
    roomType: { deleteMany: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  },
}));

import { prisma } from "../src/config/database";
import { hotelsService } from "../src/modules/hotels/hotels.service";

const mockedPrisma = prisma as any;

const superAdmin = { id: "sa1", role: "SUPER_ADMIN", hotelId: null } as any;
const hotelAdminA = { id: "ha1", role: "HOTEL_ADMIN", hotelId: "hotelA" } as any;

beforeEach(() => jest.clearAllMocks());

describe("hotelsService.create", () => {
  it("rejects an inactive/unknown hotel type", async () => {
    mockedPrisma.hotelType.findUnique.mockResolvedValue({ id: "t1", isActive: false });

    await expect(
      hotelsService.create(superAdmin, { name: "X", slug: "x", hotelTypeId: "t1" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("blocks re-creating a hotel with a slug already used by an ACTIVE hotel", async () => {
    mockedPrisma.hotel.findUnique.mockResolvedValue({ id: "existing", isActive: true, slug: "x" });

    await expect(hotelsService.create(superAdmin, { name: "X", slug: "x" })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("requires reactivateIfInactive to reuse a deactivated hotel's slug", async () => {
    mockedPrisma.hotel.findUnique.mockResolvedValue({ id: "old", isActive: false, slug: "x" });

    await expect(hotelsService.create(superAdmin, { name: "X", slug: "x" })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("reactivates and overwrites the deactivated hotel when reactivateIfInactive is set", async () => {
    mockedPrisma.hotel.findUnique.mockResolvedValue({ id: "old", isActive: false, slug: "x" });
    mockedPrisma.hotel.update.mockResolvedValue({ id: "old", name: "X", slug: "x", isActive: true });

    const result = await hotelsService.create(superAdmin, { name: "X", slug: "x", reactivateIfInactive: true });

    expect(mockedPrisma.hotel.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "old" }, data: expect.objectContaining({ isActive: true }) })
    );
    expect(result.isActive).toBe(true);
    expect(mockedPrisma.auditLog.create).toHaveBeenCalled();
  });

  it("creates a brand-new hotel and writes an audit entry", async () => {
    mockedPrisma.hotel.findUnique.mockResolvedValue(null);
    mockedPrisma.hotel.create.mockResolvedValue({ id: "new1", name: "X", slug: "x" });

    const result = await hotelsService.create(superAdmin, { name: "X", slug: "x" });

    expect(result.id).toBe("new1");
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "PROPERTY_HOTEL_CREATED" }) })
    );
  });
});

describe("hotelsService.list scoping", () => {
  it("pins a non-SUPER_ADMIN staff member to only their own hotel, ignoring status/search filters", async () => {
    mockedPrisma.hotel.findMany.mockResolvedValue([]);

    await hotelsService.list(hotelAdminA, { status: "all", search: "anything" });

    expect(mockedPrisma.hotel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "hotelA" }) })
    );
  });

  it("defaults to active-only hotels for SUPER_ADMIN when no status is given", async () => {
    mockedPrisma.hotel.findMany.mockResolvedValue([]);

    await hotelsService.list(superAdmin, {});

    expect(mockedPrisma.hotel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
    );
  });
});

describe("hotelsService.update / remove scoping", () => {
  it("prevents a HOTEL_ADMIN from updating a different hotel", async () => {
    mockedPrisma.hotel.findUnique.mockResolvedValue({ id: "hotelB", isActive: true });

    await expect(hotelsService.update(hotelAdminA, "hotelB", { name: "Y" })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("allows a HOTEL_ADMIN to update their own hotel", async () => {
    mockedPrisma.hotel.findUnique.mockResolvedValue({ id: "hotelA", isActive: true });
    mockedPrisma.hotel.update.mockResolvedValue({ id: "hotelA", name: "Y" });

    const result = await hotelsService.update(hotelAdminA, "hotelA", { name: "Y" });
    expect(result.name).toBe("Y");
  });
});

describe("hotelsService.permanentlyDelete", () => {
  it("refuses to hard-delete an active hotel", async () => {
    mockedPrisma.hotel.findUnique.mockResolvedValue({
      id: "h1",
      isActive: true,
      _count: { bookings: 0, guests: 0, rooms: 0, users: 0 },
    });

    await expect(hotelsService.permanentlyDelete(superAdmin, "h1")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("refuses to hard-delete a hotel with historical bookings", async () => {
    mockedPrisma.hotel.findUnique.mockResolvedValue({
      id: "h1",
      isActive: false,
      _count: { bookings: 3, guests: 0, rooms: 0, users: 0 },
    });

    await expect(hotelsService.permanentlyDelete(superAdmin, "h1")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("permanently deletes a clean, deactivated hotel with no history", async () => {
    mockedPrisma.hotel.findUnique.mockResolvedValue({
      id: "h1",
      name: "Empty Hotel",
      slug: "empty",
      isActive: false,
      _count: { bookings: 0, guests: 0, rooms: 0, users: 0 },
    });
    mockedPrisma.hotel.delete.mockResolvedValue({ id: "h1" });

    const result = await hotelsService.permanentlyDelete(superAdmin, "h1");
    expect(result).toEqual({ id: "h1" });
    expect(mockedPrisma.hotel.delete).toHaveBeenCalledWith({ where: { id: "h1" } });
  });
});
