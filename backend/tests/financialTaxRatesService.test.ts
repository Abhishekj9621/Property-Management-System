jest.mock("../src/config/database", () => {
  const prisma: any = {
    taxRate: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return { prisma };
});

import { prisma } from "../src/config/database";
import { taxRatesService } from "../src/modules/financial/tax-rates/tax-rates.service";

const mockedPrisma = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe("taxRatesService.createTaxRate", () => {
  it("unsets any existing default before creating a new default rate", async () => {
    mockedPrisma.taxRate.create.mockResolvedValue({ id: "t1", name: "GST 5%", isDefault: true });

    await taxRatesService.createTaxRate("hotelA", { name: "GST 5%", percentage: 5, isDefault: true });

    expect(mockedPrisma.taxRate.updateMany).toHaveBeenCalledWith({ where: { hotelId: "hotelA", isDefault: true }, data: { isDefault: false } });
    expect(mockedPrisma.taxRate.create).toHaveBeenCalledWith({ data: expect.objectContaining({ hotelId: "hotelA", name: "GST 5%" }) });
  });

  it("does not touch other defaults when isDefault is false", async () => {
    mockedPrisma.taxRate.create.mockResolvedValue({ id: "t2", name: "Luxury Tax", isDefault: false });

    await taxRatesService.createTaxRate("hotelA", { name: "Luxury Tax", percentage: 12, isDefault: false });

    expect(mockedPrisma.taxRate.updateMany).not.toHaveBeenCalled();
  });
});

describe("taxRatesService.updateTaxRate", () => {
  it("rejects updating a tax rate that isn't scoped to this hotel", async () => {
    mockedPrisma.taxRate.findFirst.mockResolvedValue(null);
    await expect(taxRatesService.updateTaxRate("hotelA", "t1", { percentage: 8 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("excludes the rate itself when clearing other defaults", async () => {
    mockedPrisma.taxRate.findFirst.mockResolvedValue({ id: "t1", hotelId: "hotelA" });
    mockedPrisma.taxRate.update.mockResolvedValue({ id: "t1", isDefault: true });

    await taxRatesService.updateTaxRate("hotelA", "t1", { isDefault: true });

    expect(mockedPrisma.taxRate.updateMany).toHaveBeenCalledWith({ where: { hotelId: "hotelA", isDefault: true, NOT: { id: "t1" } }, data: { isDefault: false } });
  });
});

describe("taxRatesService.deleteTaxRate", () => {
  it("soft-deletes by setting isActive to false rather than removing the row", async () => {
    mockedPrisma.taxRate.findFirst.mockResolvedValue({ id: "t1", hotelId: "hotelA" });

    await taxRatesService.deleteTaxRate("hotelA", "t1");

    expect(mockedPrisma.taxRate.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { isActive: false } });
  });
});
