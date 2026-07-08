jest.mock("../src/config/database", () => {
  const prisma: any = {
    expenseCategory: { findFirst: jest.fn() },
    vendor: { findFirst: jest.fn() },
    recurringExpense: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    expense: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return { prisma };
});

import { prisma } from "../src/config/database";
import { recurringExpenseService } from "../src/modules/expenses/recurring/recurring.service";

const mockedPrisma = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe("recurringExpenseService.create", () => {
  it("initializes nextRunDate to startDate", async () => {
    mockedPrisma.recurringExpense.create.mockResolvedValue({ id: "r1" });
    await recurringExpenseService.create("hotelA", "u1", { title: "Rent", amount: 5000, frequency: "MONTHLY", startDate: "2026-08-01T00:00:00.000Z" });
    expect(mockedPrisma.recurringExpense.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nextRunDate: new Date("2026-08-01T00:00:00.000Z") }) })
    );
  });

  it("rejects an unknown category", async () => {
    mockedPrisma.expenseCategory.findFirst.mockResolvedValue(null);
    await expect(
      recurringExpenseService.create("hotelA", "u1", { title: "Rent", amount: 5000, frequency: "MONTHLY", startDate: "2026-08-01T00:00:00.000Z", categoryId: "bad" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("recurringExpenseService.runDueRecurringExpenses", () => {
  it("generates an Expense for each due template and advances nextRunDate by frequency", async () => {
    mockedPrisma.recurringExpense.findMany.mockResolvedValue([
      { id: "r1", hotelId: "hotelA", categoryId: "c1", vendorId: null, title: "Rent", description: null, amount: 5000, isReimbursable: false, frequency: "MONTHLY", nextRunDate: new Date("2026-07-01T00:00:00.000Z"), endDate: null, isActive: true, createdById: "u1" },
    ]);
    mockedPrisma.expense.create.mockResolvedValue({ id: "e1", hotelId: "hotelA", categoryId: "c1", amount: 5000 });

    const generated = await recurringExpenseService.runDueRecurringExpenses(new Date("2026-07-02T00:00:00.000Z"));

    expect(generated).toHaveLength(1);
    expect(mockedPrisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recurringExpenseId: "r1", status: "SUBMITTED", hotelId: "hotelA" }) })
    );
    expect(mockedPrisma.recurringExpense.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r1" }, data: expect.objectContaining({ nextRunDate: new Date("2026-08-01T00:00:00.000Z") }) })
    );
  });

  it("auto-deactivates a template once the next run would be past its endDate", async () => {
    mockedPrisma.recurringExpense.findMany.mockResolvedValue([
      {
        id: "r1",
        hotelId: "hotelA",
        categoryId: null,
        vendorId: null,
        title: "Seasonal contract",
        description: null,
        amount: 1000,
        isReimbursable: false,
        frequency: "MONTHLY",
        nextRunDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2026-07-15T00:00:00.000Z"), // next run (Aug 1) would be past this
        isActive: true,
        createdById: "u1",
      },
    ]);
    mockedPrisma.expense.create.mockResolvedValue({ id: "e1", hotelId: "hotelA", categoryId: null, amount: 1000 });

    await recurringExpenseService.runDueRecurringExpenses(new Date("2026-07-02T00:00:00.000Z"));

    expect(mockedPrisma.recurringExpense.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }));
  });

  it("does nothing when no templates are due", async () => {
    mockedPrisma.recurringExpense.findMany.mockResolvedValue([]);
    const generated = await recurringExpenseService.runDueRecurringExpenses();
    expect(generated).toEqual([]);
    expect(mockedPrisma.expense.create).not.toHaveBeenCalled();
  });
});

describe("recurringExpenseService.remove", () => {
  it("refuses to remove a template that doesn't belong to this hotel", async () => {
    mockedPrisma.recurringExpense.findFirst.mockResolvedValue(null);
    await expect(recurringExpenseService.remove("hotelA", "r1")).rejects.toMatchObject({ statusCode: 404 });
  });
});
