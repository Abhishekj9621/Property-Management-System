import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { postLedgerEntry, assertPeriodOpen } from "../shared/ledger.helper";

export const ledgerService = {
  async listEntries(
    hotelId: string,
    filters: { type?: string; direction?: string; sourceType?: string; from?: string; to?: string; page?: number; limit?: number }
  ) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 200) : 50;

    const where: Prisma.LedgerEntryWhereInput = {
      hotelId,
      ...(filters.type ? { type: filters.type as any } : {}),
      ...(filters.direction ? { direction: filters.direction as any } : {}),
      ...(filters.sourceType ? { sourceType: filters.sourceType as any } : {}),
      ...(filters.from || filters.to
        ? { entryDate: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } }
        : {}),
    };

    const [items, total, totals] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { entryDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ledgerEntry.count({ where }),
      prisma.ledgerEntry.groupBy({ by: ["direction"], where, _sum: { amount: true } }),
    ]);

    const debit = Number(totals.find((t: any) => t.direction === "DEBIT")?._sum.amount ?? 0);
    const credit = Number(totals.find((t: any) => t.direction === "CREDIT")?._sum.amount ?? 0);

    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), summary: { debit, credit, net: credit - debit } };
  },

  /** Manual adjustment entries for corrections that don't originate from an
   * invoice/refund/credit-note (e.g. a bank reconciliation write-off). */
  async createManualEntry(hotelId: string, createdById: string | undefined, data: { type: string; direction: string; amount: number; description: string; entryDate?: string }) {
    const entryDate = data.entryDate ? new Date(data.entryDate) : new Date();
    await assertPeriodOpen(hotelId, entryDate);
    return postLedgerEntry({
      hotelId,
      type: data.type as any,
      direction: data.direction as any,
      amount: data.amount,
      description: data.description,
      sourceType: "MANUAL",
      createdById,
      entryDate,
    });
  },
};
