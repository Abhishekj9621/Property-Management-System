jest.mock("../src/config/database", () => {
  const prisma: any = {
    vendor: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    expense: { aggregate: jest.fn() },
  };
  return { prisma };
});

import { prisma } from "../src/config/database";
import { vendorsService } from "../src/modules/expenses/vendors/vendors.service";

const mockedPrisma = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe("vendorsService.create", () => {
  it("surfaces a duplicate vendor name as a 409 conflict, not a raw Prisma error", async () => {
    mockedPrisma.vendor.create.mockRejectedValue({ code: "P2002" });
    await expect(vendorsService.create("hotelA", "u1", { name: "ACME" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("creates the vendor scoped to the hotel", async () => {
    mockedPrisma.vendor.create.mockResolvedValue({ id: "v1", name: "ACME", hotelId: "hotelA" });
    const vendor = await vendorsService.create("hotelA", "u1", { name: "ACME" });
    expect(mockedPrisma.vendor.create).toHaveBeenCalledWith({ data: { name: "ACME", hotelId: "hotelA", createdById: "u1" } });
    expect(vendor.id).toBe("v1");
  });
});

describe("vendorsService.update", () => {
  it("refuses to update a vendor outside this hotel (e.g. a platform-wide one)", async () => {
    mockedPrisma.vendor.findFirst.mockResolvedValue(null);
    await expect(vendorsService.update("hotelA", "v1", { name: "New" })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("vendorsService.deactivate", () => {
  it("soft-deletes by setting isActive false", async () => {
    mockedPrisma.vendor.findFirst.mockResolvedValue({ id: "v1", hotelId: "hotelA" });
    await vendorsService.deactivate("hotelA", "v1");
    expect(mockedPrisma.vendor.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { isActive: false } });
  });
});

describe("vendorsService.spendSummary", () => {
  it("aggregates only approved/reimbursed/paid expenses for that vendor", async () => {
    mockedPrisma.vendor.findFirst.mockResolvedValue({ id: "v1", hotelId: "hotelA", name: "ACME" });
    mockedPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 4500 }, _count: 3 });

    const summary = await vendorsService.spendSummary("hotelA", "v1");

    expect(mockedPrisma.expense.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ vendorId: "v1", status: { in: ["APPROVED", "REIMBURSED", "PAID"] } }) })
    );
    expect(summary).toMatchObject({ totalSpend: 4500, expenseCount: 3 });
  });
});
