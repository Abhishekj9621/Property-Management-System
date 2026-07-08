jest.mock("../src/config/database", () => {
  const prisma: any = {
    expenseBudget: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findFirst: jest.fn() },
    expenseCategory: { findFirst: jest.fn() },
    expense: { aggregate: jest.fn() },
  };
  return { prisma };
});

jest.mock("../src/modules/notifications/notifications.service", () => ({
  notificationsService: { createForHotelStaff: jest.fn().mockResolvedValue([]) },
}));

import { prisma } from "../src/config/database";
import { notificationsService } from "../src/modules/notifications/notifications.service";
import { budgetsService, checkBudgetAfterSpend } from "../src/modules/expenses/budgets/budgets.service";

const mockedPrisma = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe("budgetsService.create", () => {
  it("rejects an unknown category", async () => {
    mockedPrisma.expenseCategory.findFirst.mockResolvedValue(null);
    await expect(budgetsService.create("hotelA", { categoryId: "bad", year: 2026, month: 7, amount: 1000, alertThresholdPercent: 90 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("surfaces a duplicate hotel/category/period budget as a 409", async () => {
    mockedPrisma.expenseCategory.findFirst.mockResolvedValue({ id: "c1" });
    mockedPrisma.expenseBudget.create.mockRejectedValue({ code: "P2002" });
    await expect(budgetsService.create("hotelA", { categoryId: "c1", year: 2026, month: 7, amount: 1000, alertThresholdPercent: 90 })).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("budgetsService.list", () => {
  it("computes committedSpend, actualSpend, remaining, and percentUsed per budget", async () => {
    mockedPrisma.expenseBudget.findMany.mockResolvedValue([{ id: "b1", hotelId: "hotelA", categoryId: "c1", year: 2026, month: 7, amount: 1000, category: { name: "Utilities" } }]);
    mockedPrisma.expense.aggregate.mockResolvedValueOnce({ _sum: { amount: 900 } }).mockResolvedValueOnce({ _sum: { amount: 700 } });

    const [budget] = await budgetsService.list("hotelA", {});

    expect(budget.committedSpend).toBe(900);
    expect(budget.actualSpend).toBe(700);
    expect(budget.remaining).toBe(300);
    expect(budget.percentUsed).toBe(90);
  });
});

describe("checkBudgetAfterSpend", () => {
  it("does nothing when no budget exists for the period", async () => {
    mockedPrisma.expenseBudget.findFirst.mockResolvedValue(null);
    await checkBudgetAfterSpend("hotelA", "c1", new Date("2026-07-15"), 500);
    expect(notificationsService.createForHotelStaff).not.toHaveBeenCalled();
  });

  it("notifies staff the moment committed spend crosses the alert threshold", async () => {
    mockedPrisma.expenseBudget.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", categoryId: "c1", year: 2026, month: 7, amount: 1000, alertThresholdPercent: 90, category: { name: "Utilities" } });
    // Spend after this expense is 950 (95% of 1000); this expense added 200,
    // so spend before was 750 (75%) — crossing the 90% threshold right now.
    mockedPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 950 } });

    await checkBudgetAfterSpend("hotelA", "c1", new Date("2026-07-15"), 200);

    expect(notificationsService.createForHotelStaff).toHaveBeenCalledTimes(1);
    expect(notificationsService.createForHotelStaff).toHaveBeenCalledWith(
      "hotelA",
      expect.objectContaining({ title: "Budget alert" })
    );
  });

  it("does not re-notify on a subsequent expense that was already over threshold", async () => {
    mockedPrisma.expenseBudget.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", categoryId: "c1", year: 2026, month: 7, amount: 1000, alertThresholdPercent: 90, category: { name: "Utilities" } });
    // Spend after is 1050 (105%), this expense added 50, so spend before was
    // 1000 (100%) — already past threshold before this expense, so no new alert.
    mockedPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 1050 } });

    await checkBudgetAfterSpend("hotelA", "c1", new Date("2026-07-20"), 50);

    expect(notificationsService.createForHotelStaff).not.toHaveBeenCalled();
  });

  it("titles the alert 'Budget exceeded' once spend is at/over 100%", async () => {
    mockedPrisma.expenseBudget.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", categoryId: "c1", year: 2026, month: 7, amount: 1000, alertThresholdPercent: 90, category: { name: "Utilities" } });
    mockedPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 1100 } });

    await checkBudgetAfterSpend("hotelA", "c1", new Date("2026-07-20"), 400);

    expect(notificationsService.createForHotelStaff).toHaveBeenCalledWith("hotelA", expect.objectContaining({ title: "Budget exceeded" }));
  });
});
