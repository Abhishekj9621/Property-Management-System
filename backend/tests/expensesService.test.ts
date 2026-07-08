jest.mock("../src/config/database", () => {
  const prisma: any = {
    expenseCategory: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    vendor: { findFirst: jest.fn() },
    expense: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn(), aggregate: jest.fn() },
    expenseAttachment: { create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
    hotel: { findUnique: jest.fn() },
  };
  return { prisma };
});

jest.mock("../src/modules/notifications/notifications.service", () => ({
  notificationsService: { createForHotelStaff: jest.fn().mockResolvedValue([]) },
}));

jest.mock("../src/modules/expenses/budgets/budgets.service", () => ({
  checkBudgetAfterSpend: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../src/config/database";
import { expensesService } from "../src/modules/expenses/expenses.service";
import { checkBudgetAfterSpend } from "../src/modules/expenses/budgets/budgets.service";

const mockedPrisma = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe("expensesService.createExpense", () => {
  it("rejects a category that doesn't belong to this hotel or the platform", async () => {
    mockedPrisma.expenseCategory.findFirst.mockResolvedValue(null);
    await expect(expensesService.createExpense("hotelA", "u1", { categoryId: "bad-cat", amount: 100, title: "x" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a vendor that doesn't belong to this hotel or the platform", async () => {
    mockedPrisma.expenseCategory.findFirst.mockResolvedValue(null);
    mockedPrisma.vendor.findFirst.mockResolvedValue(null);
    await expect(expensesService.createExpense("hotelA", "u1", { vendorId: "bad-vendor", amount: 100, title: "x" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("creates the expense as SUBMITTED and checks the budget threshold", async () => {
    mockedPrisma.expense.create.mockResolvedValue({ id: "e1", categoryId: "c1", amount: 500, expenseDate: new Date("2026-07-01"), hotelId: "hotelA" });

    const expense = await expensesService.createExpense("hotelA", "u1", { amount: 500, title: "Office supplies" });

    expect(mockedPrisma.expense.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SUBMITTED", hotelId: "hotelA" }) }));
    expect(checkBudgetAfterSpend).toHaveBeenCalledWith("hotelA", "c1", expense.expenseDate, 500);
  });

  it("creates attachments inline when provided", async () => {
    mockedPrisma.expense.create.mockResolvedValue({ id: "e1", categoryId: null, amount: 100, expenseDate: new Date() });
    await expensesService.createExpense("hotelA", "u1", { amount: 100, title: "x", attachments: [{ url: "https://x.com/r.pdf", fileName: "r.pdf" }] });
    const callArg = mockedPrisma.expense.create.mock.calls[0][0];
    expect(callArg.data.attachments.create).toHaveLength(1);
    expect(callArg.data.attachments.create[0]).toMatchObject({ url: "https://x.com/r.pdf", uploadedById: "u1" });
  });
});

describe("expensesService.updateExpense", () => {
  it("only allows editing DRAFT/SUBMITTED expenses", async () => {
    mockedPrisma.expense.findFirst.mockResolvedValue({ id: "e1", status: "APPROVED", submittedById: "u1" });
    await expect(expensesService.updateExpense("hotelA", "e1", "u1", false, { title: "new" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("refuses to let a non-manager edit someone else's claim", async () => {
    mockedPrisma.expense.findFirst.mockResolvedValue({ id: "e1", status: "SUBMITTED", submittedById: "someone-else" });
    await expect(expensesService.updateExpense("hotelA", "e1", "u1", false, { title: "new" })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows a manager to edit any submitted claim", async () => {
    mockedPrisma.expense.findFirst.mockResolvedValue({ id: "e1", status: "SUBMITTED", submittedById: "someone-else" });
    mockedPrisma.expense.update.mockResolvedValue({ id: "e1", title: "new" });
    const result = await expensesService.updateExpense("hotelA", "e1", "manager1", true, { title: "new" });
    expect(result.title).toBe("new");
  });
});

describe("expensesService.decideExpense — status transitions", () => {
  it("rejects an invalid transition", async () => {
    mockedPrisma.expense.findFirst.mockResolvedValue({ id: "e1", status: "REJECTED", amount: 100 });
    await expect(expensesService.decideExpense("hotelA", "e1", "mgr1", "MANAGER", "APPROVED", {})).rejects.toMatchObject({ statusCode: 409 });
  });

  it("requires a rejectionReason when rejecting", async () => {
    mockedPrisma.expense.findFirst.mockResolvedValue({ id: "e1", status: "SUBMITTED", amount: 100 });
    await expect(expensesService.decideExpense("hotelA", "e1", "mgr1", "MANAGER", "REJECTED", {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it("approves normally when no high-value threshold is configured", async () => {
    mockedPrisma.expense.findFirst.mockResolvedValue({ id: "e1", status: "SUBMITTED", amount: 100000 });
    mockedPrisma.hotel.findUnique.mockResolvedValue({ highValueExpenseThreshold: null });
    mockedPrisma.expense.update.mockResolvedValue({ id: "e1", status: "APPROVED" });
    const result = await expensesService.decideExpense("hotelA", "e1", "mgr1", "MANAGER", "APPROVED", {});
    expect(result.status).toBe("APPROVED");
  });
});

describe("expensesService.decideExpense — high-value approval threshold", () => {
  it("blocks a plain MANAGER from approving an expense at/above the threshold", async () => {
    mockedPrisma.expense.findFirst.mockResolvedValue({ id: "e1", status: "SUBMITTED", amount: 6000 });
    mockedPrisma.hotel.findUnique.mockResolvedValue({ highValueExpenseThreshold: 5000 });

    await expect(expensesService.decideExpense("hotelA", "e1", "mgr1", "MANAGER", "APPROVED", {})).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows a HOTEL_ADMIN to approve an expense at/above the threshold", async () => {
    mockedPrisma.expense.findFirst.mockResolvedValue({ id: "e1", status: "SUBMITTED", amount: 6000 });
    mockedPrisma.hotel.findUnique.mockResolvedValue({ highValueExpenseThreshold: 5000 });
    mockedPrisma.expense.update.mockResolvedValue({ id: "e1", status: "APPROVED" });

    const result = await expensesService.decideExpense("hotelA", "e1", "admin1", "HOTEL_ADMIN", "APPROVED", {});
    expect(result.status).toBe("APPROVED");
  });

  it("still lets a plain MANAGER approve an expense below the threshold", async () => {
    mockedPrisma.expense.findFirst.mockResolvedValue({ id: "e1", status: "SUBMITTED", amount: 4000 });
    mockedPrisma.hotel.findUnique.mockResolvedValue({ highValueExpenseThreshold: 5000 });
    mockedPrisma.expense.update.mockResolvedValue({ id: "e1", status: "APPROVED" });

    const result = await expensesService.decideExpense("hotelA", "e1", "mgr1", "MANAGER", "APPROVED", {});
    expect(result.status).toBe("APPROVED");
  });
});

describe("expensesService.decideExpense — reimbursement/payment tracking", () => {
  it("stamps paymentMethod/paymentReference/paidAt when marking REIMBURSED", async () => {
    mockedPrisma.expense.findFirst.mockResolvedValue({ id: "e1", status: "APPROVED", amount: 200 });
    mockedPrisma.expense.update.mockResolvedValue({ id: "e1", status: "REIMBURSED" });

    await expensesService.decideExpense("hotelA", "e1", "mgr1", "MANAGER", "REIMBURSED", { paymentMethod: "BANK_TRANSFER", paymentReference: "TXN-1" });

    expect(mockedPrisma.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentMethod: "BANK_TRANSFER", paymentReference: "TXN-1" }) })
    );
  });
});

describe("expensesService.deleteExpense", () => {
  it("refuses to delete an approved expense", async () => {
    mockedPrisma.expense.findFirst.mockResolvedValue({ id: "e1", status: "APPROVED" });
    await expect(expensesService.deleteExpense("hotelA", "e1")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("allows deleting a rejected expense", async () => {
    mockedPrisma.expense.findFirst.mockResolvedValue({ id: "e1", status: "REJECTED" });
    const result = await expensesService.deleteExpense("hotelA", "e1");
    expect(result).toEqual({ id: "e1" });
  });
});
