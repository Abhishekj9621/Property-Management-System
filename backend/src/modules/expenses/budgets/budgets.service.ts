import { prisma } from "../../../config/database";
import { ApiError } from "../../../utils/ApiError";
import { notificationsService } from "../../notifications/notifications.service";

const COMMITTED_STATUSES = ["SUBMITTED", "APPROVED", "REIMBURSED", "PAID"];
const ACTUAL_STATUSES = ["APPROVED", "REIMBURSED", "PAID"];

function monthBounds(year: number, month?: number | null) {
  if (month) {
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)) };
  }
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)) };
}

async function computeSpend(hotelId: string, categoryId: string | null, year: number, month: number | null, statuses: string[]) {
  const { start, end } = monthBounds(year, month);
  const agg = await prisma.expense.aggregate({
    where: { hotelId, categoryId: categoryId ?? undefined, expenseDate: { gte: start, lte: end }, status: { in: statuses as any } },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

export const budgetsService = {
  async list(hotelId: string, filters: { year?: number; month?: number; categoryId?: string }) {
    const budgets = await prisma.expenseBudget.findMany({
      where: {
        hotelId,
        ...(filters.year ? { year: filters.year } : {}),
        ...(filters.month ? { month: filters.month } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      },
      include: { category: true },
      orderBy: [{ year: "desc" }, { month: "asc" }],
    });

    return Promise.all(
      budgets.map(async (b: any) => {
        const committed = await computeSpend(hotelId, b.categoryId, b.year, b.month, COMMITTED_STATUSES);
        const actual = await computeSpend(hotelId, b.categoryId, b.year, b.month, ACTUAL_STATUSES);
        const amount = Number(b.amount);
        return {
          ...b,
          committedSpend: committed,
          actualSpend: actual,
          remaining: Number((amount - actual).toFixed(2)),
          percentUsed: amount > 0 ? Math.round((committed / amount) * 100) : 0,
        };
      })
    );
  },

  async create(hotelId: string, data: { categoryId?: string; year: number; month?: number; amount: number; alertThresholdPercent: number }) {
    if (data.categoryId) {
      const category = await prisma.expenseCategory.findFirst({ where: { id: data.categoryId, OR: [{ hotelId }, { hotelId: null }] } });
      if (!category) throw ApiError.badRequest("Expense category not found");
    }
    try {
      return await prisma.expenseBudget.create({
        data: { hotelId, categoryId: data.categoryId, year: data.year, month: data.month, amount: data.amount, alertThresholdPercent: data.alertThresholdPercent },
        include: { category: true },
      });
    } catch (err: any) {
      if (err?.code === "P2002") throw ApiError.conflict("A budget for this hotel/category/period already exists");
      throw err;
    }
  },

  async update(hotelId: string, id: string, data: any) {
    const existing = await prisma.expenseBudget.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Budget not found");
    return prisma.expenseBudget.update({ where: { id }, data, include: { category: true } });
  },

  async remove(hotelId: string, id: string) {
    const existing = await prisma.expenseBudget.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Budget not found");
    await prisma.expenseBudget.delete({ where: { id } });
    return { id };
  },
};

/**
 * Called right after an expense is created (or its status changes) to
 * proactively notify hotel managers the first time a category's committed
 * spend (SUBMITTED + APPROVED + REIMBURSED + PAID — i.e. everything not
 * yet rejected) crosses its budget's alert threshold for that period. Only
 * fires on the crossing itself (spend-before < threshold <= spend-after),
 * not on every subsequent expense once already over, to avoid notification
 * spam. Never throws — a missing/misconfigured budget just means no alert,
 * not a failed expense submission.
 */
export async function checkBudgetAfterSpend(hotelId: string, categoryId: string | null, expenseDate: Date, justAddedAmount?: number) {
  const year = expenseDate.getUTCFullYear();
  const month = expenseDate.getUTCMonth() + 1;

  const budget = await prisma.expenseBudget.findFirst({
    where: { hotelId, categoryId: categoryId ?? null, year, OR: [{ month }, { month: null }] },
    orderBy: { month: "desc" }, // prefer the monthly budget over an annual one if both exist
    include: { category: true },
  });
  if (!budget) return;

  const amount = Number(budget.amount);
  if (amount <= 0) return;

  const spendAfter = await computeSpend(hotelId, budget.categoryId, budget.year, budget.month, COMMITTED_STATUSES);
  const delta = justAddedAmount ?? 0;
  const spendBefore = spendAfter - delta;

  const percentBefore = (spendBefore / amount) * 100;
  const percentAfter = (spendAfter / amount) * 100;

  if (percentBefore < budget.alertThresholdPercent && percentAfter >= budget.alertThresholdPercent) {
    const label = budget.category?.name ?? "Overall";
    const period = budget.month ? `${budget.year}-${String(budget.month).padStart(2, "0")}` : String(budget.year);
    await notificationsService.createForHotelStaff(hotelId, {
      title: percentAfter >= 100 ? "Budget exceeded" : "Budget alert",
      message: `${label} spend for ${period} has reached ${Math.round(percentAfter)}% of its ₹${amount.toLocaleString()} budget.`,
      type: "EXPENSE_BUDGET_ALERT",
      link: "/expenses/budgets",
    });
  }
}
