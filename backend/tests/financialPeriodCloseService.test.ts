jest.mock("../src/config/database", () => {
  const prisma: any = {
    payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    ledgerEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    refund: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    expense: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    financialPeriodClose: { findUnique: jest.fn(), findFirst: jest.fn(), upsert: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  };
  return { prisma };
});

import { prisma } from "../src/config/database";
import { periodCloseService } from "../src/modules/financial/period-close/period-close.service";

const mockedPrisma = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe("periodCloseService.closeDay", () => {
  it("refuses to close a future business date", async () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    await expect(periodCloseService.closeDay("hotelA", "mgr1", future.toISOString().slice(0, 10))).rejects.toMatchObject({ statusCode: 400 });
  });

  it("refuses to close a date already covered by a later close", async () => {
    mockedPrisma.financialPeriodClose.findFirst.mockResolvedValue({ businessDate: new Date("2026-07-04"), status: "CLOSED" });
    await expect(periodCloseService.closeDay("hotelA", "mgr1", "2026-07-03")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("computes the snapshot and upserts a CLOSED record for a valid past date", async () => {
    mockedPrisma.financialPeriodClose.findFirst.mockResolvedValue(null);
    mockedPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
    mockedPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 200 } });
    mockedPrisma.financialPeriodClose.upsert.mockResolvedValue({ id: "fpc1", status: "CLOSED", netCashPosition: 800 });

    const result = await periodCloseService.closeDay("hotelA", "mgr1", "2026-07-01", "End of day");

    expect(mockedPrisma.financialPeriodClose.upsert).toHaveBeenCalled();
    expect(result.netCashPosition).toBe(800);
  });
});

describe("periodCloseService.reopenDay", () => {
  it("refuses to reopen an already-open period", async () => {
    mockedPrisma.financialPeriodClose.findFirst.mockResolvedValueOnce({ id: "fpc1", status: "OPEN" });
    await expect(periodCloseService.reopenDay("hotelA", "fpc1", "admin1", "correction needed")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("refuses to reopen when a later close exists (must reopen in reverse order)", async () => {
    mockedPrisma.financialPeriodClose.findFirst
      .mockResolvedValueOnce({ id: "fpc1", status: "CLOSED", businessDate: new Date("2026-07-01") })
      .mockResolvedValueOnce({ id: "fpc2", status: "CLOSED", businessDate: new Date("2026-07-02") });

    await expect(periodCloseService.reopenDay("hotelA", "fpc1", "admin1", "correction needed")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("reopens the most recent closed period", async () => {
    mockedPrisma.financialPeriodClose.findFirst.mockResolvedValueOnce({ id: "fpc1", status: "CLOSED", businessDate: new Date("2026-07-01"), notes: null }).mockResolvedValueOnce(null);
    mockedPrisma.financialPeriodClose.update.mockResolvedValue({ id: "fpc1", status: "OPEN" });

    const result = await periodCloseService.reopenDay("hotelA", "fpc1", "admin1", "found a missing refund");
    expect(result.status).toBe("OPEN");
  });
});
