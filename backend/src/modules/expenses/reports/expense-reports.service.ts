import { prisma } from "../../../config/database";

const ACTUAL_STATUSES = ["APPROVED", "REIMBURSED", "PAID"];

function toCsv(rows: Record<string, any>[], columns: { key: string; header: string }[]): string {
  const escape = (val: any) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}

function rangeFilter(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
}

export const expenseReportsService = {
  async byCategory(hotelId: string, from?: string, to?: string) {
    const expenseDate = rangeFilter(from, to);
    const rows = await prisma.expense.groupBy({
      by: ["categoryId"],
      where: { hotelId, status: { in: ACTUAL_STATUSES as any }, ...(expenseDate ? { expenseDate } : {}) },
      _sum: { amount: true },
      _count: true,
    });
    const categories = await prisma.expenseCategory.findMany({ where: { OR: [{ hotelId }, { hotelId: null }] } });
    const byId = new Map(categories.map((c: any) => [c.id, c.name]));
    return rows
      .map((r: any) => ({ categoryId: r.categoryId, categoryName: r.categoryId ? byId.get(r.categoryId) ?? "Unknown" : "Uncategorized", total: Number(r._sum.amount ?? 0), count: r._count }))
      .sort((a: any, b: any) => b.total - a.total);
  },

  async byVendor(hotelId: string, from?: string, to?: string) {
    const expenseDate = rangeFilter(from, to);
    const rows = await prisma.expense.groupBy({
      by: ["vendorId"],
      where: { hotelId, status: { in: ACTUAL_STATUSES as any }, vendorId: { not: null }, ...(expenseDate ? { expenseDate } : {}) },
      _sum: { amount: true },
      _count: true,
    });
    const vendors = await prisma.vendor.findMany({ where: { OR: [{ hotelId }, { hotelId: null }] } });
    const byId = new Map(vendors.map((v: any) => [v.id, v.name]));
    return rows
      .map((r: any) => ({ vendorId: r.vendorId, vendorName: r.vendorId ? byId.get(r.vendorId) ?? "Unknown" : "—", total: Number(r._sum.amount ?? 0), count: r._count }))
      .sort((a: any, b: any) => b.total - a.total);
  },

  /** Month-by-month total for the last N months (default 6), for a simple trend chart. */
  async monthlyTrend(hotelId: string, months = 6) {
    const now = new Date();
    const results: { month: string; total: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      const agg = await prisma.expense.aggregate({
        where: { hotelId, status: { in: ACTUAL_STATUSES as any }, expenseDate: { gte: start, lte: end } },
        _sum: { amount: true },
      });
      results.push({ month: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`, total: Number(agg._sum.amount ?? 0) });
    }
    return results;
  },

  async summary(hotelId: string, from?: string, to?: string) {
    const expenseDate = rangeFilter(from, to);
    const [actual, pending, reimbursable] = await Promise.all([
      prisma.expense.aggregate({ where: { hotelId, status: { in: ACTUAL_STATUSES as any }, ...(expenseDate ? { expenseDate } : {}) }, _sum: { amount: true }, _count: true }),
      prisma.expense.aggregate({ where: { hotelId, status: "SUBMITTED", ...(expenseDate ? { expenseDate } : {}) }, _sum: { amount: true }, _count: true }),
      prisma.expense.aggregate({
        where: { hotelId, isReimbursable: true, status: { in: ["APPROVED"] }, ...(expenseDate ? { expenseDate } : {}) },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return {
      from: from ?? null,
      to: to ?? null,
      totalSpend: Number(actual._sum.amount ?? 0),
      totalSpendCount: actual._count,
      pendingApproval: Number(pending._sum.amount ?? 0),
      pendingApprovalCount: pending._count,
      awaitingReimbursement: Number(reimbursable._sum.amount ?? 0),
      awaitingReimbursementCount: reimbursable._count,
    };
  },

  byCategoryCsv(rows: { categoryName: string; total: number; count: number }[]) {
    return toCsv(rows, [
      { key: "categoryName", header: "Category" },
      { key: "total", header: "Total Spend" },
      { key: "count", header: "Expense Count" },
    ]);
  },

  byVendorCsv(rows: { vendorName: string; total: number; count: number }[]) {
    return toCsv(rows, [
      { key: "vendorName", header: "Vendor" },
      { key: "total", header: "Total Spend" },
      { key: "count", header: "Expense Count" },
    ]);
  },
};
