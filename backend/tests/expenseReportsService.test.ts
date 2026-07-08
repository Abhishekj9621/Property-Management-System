jest.mock("../src/config/database", () => {
  const prisma: any = {
    expense: { groupBy: jest.fn(), aggregate: jest.fn() },
    expenseCategory: { findMany: jest.fn() },
    vendor: { findMany: jest.fn() },
  };
  return { prisma };
});

import { prisma } from "../src/config/database";
import { expenseReportsService } from "../src/modules/expenses/reports/expense-reports.service";

const mockedPrisma = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe("expenseReportsService.byCategory", () => {
  it("joins category names and sorts by total spend descending", async () => {
    mockedPrisma.expense.groupBy.mockResolvedValue([
      { categoryId: "c1", _sum: { amount: 300 }, _count: 2 },
      { categoryId: "c2", _sum: { amount: 900 }, _count: 5 },
    ]);
    mockedPrisma.expenseCategory.findMany.mockResolvedValue([
      { id: "c1", name: "Utilities" },
      { id: "c2", name: "Maintenance" },
    ]);

    const rows = await expenseReportsService.byCategory("hotelA");

    expect(rows[0]).toMatchObject({ categoryName: "Maintenance", total: 900 });
    expect(rows[1]).toMatchObject({ categoryName: "Utilities", total: 300 });
  });

  it("labels a null categoryId as Uncategorized", async () => {
    mockedPrisma.expense.groupBy.mockResolvedValue([{ categoryId: null, _sum: { amount: 100 }, _count: 1 }]);
    mockedPrisma.expenseCategory.findMany.mockResolvedValue([]);
    const rows = await expenseReportsService.byCategory("hotelA");
    expect(rows[0].categoryName).toBe("Uncategorized");
  });
});

describe("expenseReportsService.byVendor", () => {
  it("joins vendor names and sorts by total spend descending", async () => {
    mockedPrisma.expense.groupBy.mockResolvedValue([
      { vendorId: "v1", _sum: { amount: 1200 }, _count: 3 },
      { vendorId: "v2", _sum: { amount: 400 }, _count: 1 },
    ]);
    mockedPrisma.vendor.findMany.mockResolvedValue([
      { id: "v1", name: "ACME" },
      { id: "v2", name: "Globex" },
    ]);

    const rows = await expenseReportsService.byVendor("hotelA");
    expect(rows[0]).toMatchObject({ vendorName: "ACME", total: 1200 });
  });
});

describe("expenseReportsService.summary", () => {
  it("aggregates totalSpend, pendingApproval, and awaitingReimbursement separately", async () => {
    mockedPrisma.expense.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 5000 }, _count: 10 }) // actual
      .mockResolvedValueOnce({ _sum: { amount: 800 }, _count: 2 }) // pending
      .mockResolvedValueOnce({ _sum: { amount: 300 }, _count: 1 }); // reimbursable

    const result = await expenseReportsService.summary("hotelA");

    expect(result).toMatchObject({
      totalSpend: 5000,
      totalSpendCount: 10,
      pendingApproval: 800,
      pendingApprovalCount: 2,
      awaitingReimbursement: 300,
      awaitingReimbursementCount: 1,
    });
  });
});

describe("expenseReportsService CSV helpers", () => {
  it("byCategoryCsv produces a header row plus one row per category", () => {
    const csv = expenseReportsService.byCategoryCsv([{ categoryName: "Utilities", total: 300, count: 2 } as any]);
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("Utilities");
  });
});
