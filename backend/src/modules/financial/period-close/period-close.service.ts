import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { ApiError } from "../../../utils/ApiError";

function dayBounds(businessDate: string) {
  const start = new Date(`${businessDate}T00:00:00.000Z`);
  const end = new Date(`${businessDate}T23:59:59.999Z`);
  if (isNaN(start.getTime())) throw ApiError.badRequest("businessDate must be a valid date (YYYY-MM-DD)");
  return { start, end };
}

/** Computes the day's financial snapshot from source-of-truth tables
 * (Payment, Refund, Expense, LedgerEntry) without mutating anything —
 * used both for the "preview before closing" screen and the numbers
 * actually stamped onto the FinancialPeriodClose record when closed. */
async function computeSnapshot(hotelId: string, businessDate: string) {
  const { start, end } = dayBounds(businessDate);

  const [paymentsAgg, taxAgg, refundsAgg, expensesAgg] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: "PAID", paidAt: { gte: start, lte: end }, booking: { hotelId } },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { hotelId, type: "TAX", direction: "CREDIT", entryDate: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.refund.aggregate({
      where: { hotelId, status: "PROCESSED", processedAt: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { hotelId, status: { in: ["APPROVED", "REIMBURSED", "PAID"] }, expenseDate: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
  ]);

  const totalRevenue = Number(paymentsAgg._sum.amount ?? 0);
  const totalTax = Number(taxAgg._sum.amount ?? 0);
  const totalRefunds = Number(refundsAgg._sum.amount ?? 0);
  const totalExpenses = Number(expensesAgg._sum.amount ?? 0);
  const netCashPosition = Number((totalRevenue - totalRefunds - totalExpenses).toFixed(2));

  return { totalRevenue, totalTax, totalRefunds, totalExpenses, netCashPosition };
}

export const periodCloseService = {
  async preview(hotelId: string, businessDate: string) {
    const snapshot = await computeSnapshot(hotelId, businessDate);
    const existing = await prisma.financialPeriodClose.findUnique({ where: { hotelId_businessDate: { hotelId, businessDate: new Date(businessDate) } } });
    return { businessDate, ...snapshot, alreadyClosed: !!existing && existing.status === "CLOSED" };
  },

  async closeDay(hotelId: string, closedById: string | undefined, businessDate: string, notes?: string) {
    const targetDate = new Date(businessDate);
    if (targetDate > new Date()) throw ApiError.badRequest("Cannot close a future business date");

    const latestClose = await prisma.financialPeriodClose.findFirst({
      where: { hotelId, status: "CLOSED" },
      orderBy: { businessDate: "desc" },
    });
    if (latestClose && targetDate <= new Date(latestClose.businessDate)) {
      throw ApiError.conflict(
        `${businessDate} is already covered by the close dated ${new Date(latestClose.businessDate).toISOString().slice(0, 10)}. Reopen that close first if you need to amend it.`
      );
    }

    const snapshot = await computeSnapshot(hotelId, businessDate);

    return prisma.financialPeriodClose.upsert({
      where: { hotelId_businessDate: { hotelId, businessDate: targetDate } },
      create: { hotelId, businessDate: targetDate, status: "CLOSED", ...snapshot, notes, closedById, closedAt: new Date() },
      update: { status: "CLOSED", ...snapshot, notes, closedById, closedAt: new Date(), reopenedById: null, reopenedAt: null },
    });
  },

  async reopenDay(hotelId: string, id: string, reopenedById: string | undefined, reason: string) {
    const existing = await prisma.financialPeriodClose.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Financial period close not found");
    if (existing.status === "OPEN") throw ApiError.conflict("This period is already open");

    const laterClose = await prisma.financialPeriodClose.findFirst({
      where: { hotelId, status: "CLOSED", businessDate: { gt: existing.businessDate } },
    });
    if (laterClose) {
      throw ApiError.conflict("Only the most recently closed period can be reopened — reopen later closes first");
    }

    return prisma.financialPeriodClose.update({
      where: { id },
      data: { status: "OPEN", reopenedById, reopenedAt: new Date(), notes: `${existing.notes ?? ""}\n[Reopened] ${reason}`.trim() },
    });
  },

  async listCloses(hotelId: string, filters: { from?: string; to?: string; page?: number; limit?: number }) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 30;
    const where: Prisma.FinancialPeriodCloseWhereInput = {
      hotelId,
      ...(filters.from || filters.to
        ? { businessDate: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.financialPeriodClose.findMany({
        where,
        include: {
          closedBy: { select: { id: true, firstName: true, lastName: true } },
          reopenedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { businessDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.financialPeriodClose.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },
};
