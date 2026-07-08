jest.mock("../src/config/database", () => {
  const prisma: any = {
    payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }), findMany: jest.fn().mockResolvedValue([]) },
    ledgerEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    refund: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    expense: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    invoice: { findMany: jest.fn().mockResolvedValue([]) },
    hotel: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { prisma };
});

import { prisma } from "../src/config/database";
import { financialReportsService } from "../src/modules/financial/reports/financial-reports.service";

const mockedPrisma = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe("financialReportsService.profitAndLoss", () => {
  it("computes netProfit as revenue minus refunds minus expenses (tax excluded from profit)", async () => {
    mockedPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 10000 } });
    mockedPrisma.ledgerEntry.aggregate.mockResolvedValue({ _sum: { amount: 500 } });
    mockedPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
    mockedPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 2000 } });

    const pnl = await financialReportsService.profitAndLoss("hotelA", "2026-07-01", "2026-07-31");

    expect(pnl).toMatchObject({ revenue: 10000, tax: 500, refunds: 1000, expenses: 2000, netProfit: 7000 });
  });
});

describe("financialReportsService.arAging", () => {
  it("buckets outstanding invoices by age and excludes fully-paid ones", async () => {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    mockedPrisma.invoice.findMany.mockResolvedValue([
      { invoiceNumber: "INV-1", total: 1000, amountPaid: 0, dueDate: daysAgo(10), issuedAt: daysAgo(10), booking: null, guest: { firstName: "A", lastName: "B" } },
      { invoiceNumber: "INV-2", total: 500, amountPaid: 500, dueDate: daysAgo(45), issuedAt: daysAgo(45), booking: null, guest: null }, // fully paid -> excluded
      { invoiceNumber: "INV-3", total: 2000, amountPaid: 200, dueDate: daysAgo(95), issuedAt: daysAgo(95), booking: null, guest: null },
    ]);

    const result = await financialReportsService.arAging("hotelA");

    expect(result.rows).toHaveLength(2);
    expect(result.buckets["1-30"]).toBe(1000);
    expect(result.buckets["90+"]).toBe(1800);
    expect(result.totalOutstanding).toBe(2800);
  });
});

describe("financialReportsService.dailyCash", () => {
  it("groups cash-in by payment method and computes net cash", async () => {
    mockedPrisma.payment.findMany.mockResolvedValue([
      { amount: 1000, method: "CARD" },
      { amount: 500, method: "CASH" },
      { amount: 300, method: "CARD" },
    ]);
    mockedPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 200 } });
    mockedPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 100 } });

    const result = await financialReportsService.dailyCash("hotelA", "2026-07-04");

    expect(result.cashIn).toBe(1800);
    expect(result.byMethod).toEqual({ CARD: 1300, CASH: 500 });
    expect(result.netCash).toBe(1500);
  });
});
