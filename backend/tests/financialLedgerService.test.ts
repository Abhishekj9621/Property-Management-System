jest.mock("../src/config/database", () => {
  const prisma: any = {
    ledgerEntry: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn(), create: jest.fn() },
    financialPeriodClose: { findFirst: jest.fn() },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return { prisma };
});

import { prisma } from "../src/config/database";
import { ledgerService } from "../src/modules/financial/ledger/ledger.service";
import { postLedgerEntry } from "../src/modules/financial/shared/ledger.helper";

const mockedPrisma = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe("postLedgerEntry", () => {
  it("rejects a zero or negative amount", async () => {
    await expect(
      postLedgerEntry({ hotelId: "hotelA", type: "REVENUE", direction: "CREDIT", amount: 0, description: "x", sourceType: "MANUAL" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("writes an entry with the given fields", async () => {
    mockedPrisma.ledgerEntry.create.mockResolvedValue({ id: "le1" });
    await postLedgerEntry({ hotelId: "hotelA", type: "REVENUE", direction: "CREDIT", amount: 500, description: "Test", sourceType: "MANUAL", createdById: "u1" });
    expect(mockedPrisma.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ hotelId: "hotelA", amount: 500, sourceType: "MANUAL" }) })
    );
  });
});

describe("ledgerService.createManualEntry", () => {
  it("refuses to post a manual entry dated on/before a closed financial period", async () => {
    mockedPrisma.financialPeriodClose.findFirst.mockResolvedValue({ businessDate: new Date(), status: "CLOSED" });

    await expect(
      ledgerService.createManualEntry("hotelA", "u1", { type: "ADJUSTMENT", direction: "DEBIT", amount: 50, description: "Correction" })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("posts the manual entry when the period is open", async () => {
    mockedPrisma.financialPeriodClose.findFirst.mockResolvedValue(null);
    mockedPrisma.ledgerEntry.create.mockResolvedValue({ id: "le1" });

    const entry = await ledgerService.createManualEntry("hotelA", "u1", { type: "ADJUSTMENT", direction: "DEBIT", amount: 50, description: "Correction" });
    expect(entry.id).toBe("le1");
  });
});

describe("ledgerService.listEntries", () => {
  it("computes debit/credit/net summary from the groupBy result", async () => {
    mockedPrisma.ledgerEntry.findMany.mockResolvedValue([]);
    mockedPrisma.ledgerEntry.count.mockResolvedValue(0);
    mockedPrisma.ledgerEntry.groupBy.mockResolvedValue([
      { direction: "CREDIT", _sum: { amount: 1000 } },
      { direction: "DEBIT", _sum: { amount: 300 } },
    ]);

    const result = await ledgerService.listEntries("hotelA", {});
    expect(result.summary).toEqual({ debit: 300, credit: 1000, net: 700 });
  });
});
