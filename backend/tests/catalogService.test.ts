jest.mock("../src/config/database", () => ({
  prisma: {
    hotelType: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    roomCategory: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  },
}));

import { prisma } from "../src/config/database";
import { hotelTypesService, roomCategoriesService } from "../src/modules/catalog/catalog.service";

const mockedPrisma = prisma as any;
const superAdmin = { id: "sa1", role: "SUPER_ADMIN", hotelId: null } as any;

beforeEach(() => jest.clearAllMocks());

describe("hotelTypesService", () => {
  it("creates a hotel type and audits it", async () => {
    mockedPrisma.hotelType.create.mockResolvedValue({ id: "t1", name: "Resort", code: "RESORT" });

    const result = await hotelTypesService.create(superAdmin, { name: "Resort", code: "RESORT" });

    expect(result.id).toBe("t1");
    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "PROPERTY_HOTEL_TYPE_CREATED" }) })
    );
  });

  it("retires a hotel type in use instead of deleting it", async () => {
    mockedPrisma.hotelType.findUnique.mockResolvedValue({ id: "t1", _count: { hotels: 2 } });
    mockedPrisma.hotelType.update.mockResolvedValue({ id: "t1", isActive: false });

    const result = await hotelTypesService.remove(superAdmin, "t1");

    expect(result.isActive).toBe(false);
    expect(mockedPrisma.hotelType.delete).not.toHaveBeenCalled();
  });

  it("hard-deletes an unused hotel type", async () => {
    mockedPrisma.hotelType.findUnique.mockResolvedValue({ id: "t1", _count: { hotels: 0 } });
    mockedPrisma.hotelType.delete.mockResolvedValue({ id: "t1" });

    const result = await hotelTypesService.remove(superAdmin, "t1");

    expect(result).toEqual({ id: "t1" });
    expect(mockedPrisma.hotelType.delete).toHaveBeenCalled();
  });

  it("404s when updating a hotel type that doesn't exist", async () => {
    mockedPrisma.hotelType.findUnique.mockResolvedValue(null);

    await expect(hotelTypesService.update(superAdmin, "missing", { name: "X" })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("roomCategoriesService", () => {
  it("retires a room category in use instead of deleting it", async () => {
    mockedPrisma.roomCategory.findUnique.mockResolvedValue({ id: "c1", _count: { roomTypes: 5 } });
    mockedPrisma.roomCategory.update.mockResolvedValue({ id: "c1", isActive: false });

    const result = await roomCategoriesService.remove(superAdmin, "c1");

    expect(result.isActive).toBe(false);
    expect(mockedPrisma.roomCategory.delete).not.toHaveBeenCalled();
  });

  it("hard-deletes an unused room category", async () => {
    mockedPrisma.roomCategory.findUnique.mockResolvedValue({ id: "c1", _count: { roomTypes: 0 } });
    mockedPrisma.roomCategory.delete.mockResolvedValue({ id: "c1" });

    const result = await roomCategoriesService.remove(superAdmin, "c1");

    expect(result).toEqual({ id: "c1" });
  });
});
