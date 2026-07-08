import { prisma } from "../../../config/database";

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

async function computeProfitAndLoss(hotelId: string, from?: string, to?: string) {
  const paidAtRange = rangeFilter(from, to);

  const [revenueAgg, taxAgg, refundsAgg, expensesAgg] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "PAID", booking: { hotelId }, ...(paidAtRange ? { paidAt: paidAtRange } : {}) }, _sum: { amount: true } }),
    prisma.ledgerEntry.aggregate({ where: { hotelId, type: "TAX", direction: "CREDIT", ...(paidAtRange ? { entryDate: paidAtRange } : {}) }, _sum: { amount: true } }),
    prisma.refund.aggregate({ where: { hotelId, status: "PROCESSED", ...(paidAtRange ? { processedAt: paidAtRange } : {}) }, _sum: { amount: true } }),
    prisma.expense.aggregate({
      where: { hotelId, status: { in: ["APPROVED", "REIMBURSED", "PAID"] }, ...(paidAtRange ? { expenseDate: paidAtRange } : {}) },
      _sum: { amount: true },
    }),
  ]);

  const revenue = Number(revenueAgg._sum.amount ?? 0);
  const tax = Number(taxAgg._sum.amount ?? 0);
  const refunds = Number(refundsAgg._sum.amount ?? 0);
  const expenses = Number(expensesAgg._sum.amount ?? 0);
  const netProfit = Number((revenue - refunds - expenses).toFixed(2));

  return { revenue, tax, refunds, expenses, netProfit };
}

export const financialReportsService = {
  async profitAndLoss(hotelId: string, from?: string, to?: string) {
    const pnl = await computeProfitAndLoss(hotelId, from, to);
    return { from: from ?? null, to: to ?? null, ...pnl };
  },

  profitAndLossCsv(pnl: { from: string | null; to: string | null; revenue: number; tax: number; refunds: number; expenses: number; netProfit: number }) {
    return toCsv([pnl], [
      { key: "from", header: "From" },
      { key: "to", header: "To" },
      { key: "revenue", header: "Revenue" },
      { key: "tax", header: "Tax Collected" },
      { key: "refunds", header: "Refunds" },
      { key: "expenses", header: "Expenses" },
      { key: "netProfit", header: "Net Profit" },
    ]);
  },

  async arAging(hotelId: string) {
    const invoices = await prisma.invoice.findMany({
      where: { hotelId, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
      include: { booking: { select: { paidAmount: true, bookingRef: true } }, guest: { select: { firstName: true, lastName: true } } },
    });

    const now = new Date();
    const buckets = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    const rows = invoices
      .map((inv: any) => {
        const paid = inv.booking ? Number(inv.booking.paidAmount) : Number(inv.amountPaid);
        const due = Number((Number(inv.total) - paid).toFixed(2));
        if (due <= 0) return null;
        const asOf = inv.dueDate ?? inv.issuedAt;
        const ageDays = Math.floor((now.getTime() - new Date(asOf).getTime()) / (1000 * 60 * 60 * 24));
        let bucket: keyof typeof buckets = "current";
        if (ageDays > 90) bucket = "90+";
        else if (ageDays > 60) bucket = "61-90";
        else if (ageDays > 30) bucket = "31-60";
        else if (ageDays > 0) bucket = "1-30";
        buckets[bucket] += due;
        return {
          invoiceNumber: inv.invoiceNumber,
          bookingRef: inv.booking?.bookingRef ?? "—",
          guest: inv.guest ? `${inv.guest.firstName} ${inv.guest.lastName}` : "—",
          amountDue: due,
          ageDays,
          bucket,
          dueDate: (inv.dueDate ?? inv.issuedAt).toISOString().slice(0, 10),
        };
      })
      .filter(Boolean) as Array<{ invoiceNumber: string; bookingRef: string; guest: string; amountDue: number; ageDays: number; bucket: string; dueDate: string }>;

    return { buckets, totalOutstanding: Object.values(buckets).reduce((a, b) => a + b, 0), rows };
  },

  arAgingCsv(rows: Array<{ invoiceNumber: string; bookingRef: string; guest: string; amountDue: number; ageDays: number; bucket: string; dueDate: string }>) {
    return toCsv(rows, [
      { key: "invoiceNumber", header: "Invoice #" },
      { key: "bookingRef", header: "Booking Ref" },
      { key: "guest", header: "Guest" },
      { key: "amountDue", header: "Amount Due" },
      { key: "ageDays", header: "Age (days)" },
      { key: "bucket", header: "Aging Bucket" },
      { key: "dueDate", header: "Due Date" },
    ]);
  },

  async dailyCash(hotelId: string, date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const [payments, refunds, expenses] = await Promise.all([
      prisma.payment.findMany({ where: { status: "PAID", paidAt: { gte: start, lte: end }, booking: { hotelId } }, select: { amount: true, method: true } }),
      prisma.refund.aggregate({ where: { hotelId, status: "PROCESSED", processedAt: { gte: start, lte: end } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { hotelId, status: "PAID", expenseDate: { gte: start, lte: end } }, _sum: { amount: true } }),
    ]);

    const byMethod: Record<string, number> = {};
    let cashIn = 0;
    for (const p of payments) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
      cashIn += Number(p.amount);
    }
    const cashOutRefunds = Number(refunds._sum.amount ?? 0);
    const cashOutExpenses = Number(expenses._sum.amount ?? 0);

    return {
      date,
      cashIn,
      byMethod,
      cashOutRefunds,
      cashOutExpenses,
      netCash: Number((cashIn - cashOutRefunds - cashOutExpenses).toFixed(2)),
    };
  },

  /** Cross-property P&L for the platform dashboard (SUPER_ADMIN only). */
  async consolidated(from?: string, to?: string) {
    const hotels = await prisma.hotel.findMany({ where: { isActive: true }, select: { id: true, name: true, city: true } });
    const rows = await Promise.all(
      hotels.map(async (hotel: any) => {
        const pnl = await computeProfitAndLoss(hotel.id, from, to);
        return { hotelId: hotel.id, hotelName: hotel.name, city: hotel.city, ...pnl };
      })
    );
    const totals = rows.reduce(
      (acc, r) => ({
        revenue: acc.revenue + r.revenue,
        tax: acc.tax + r.tax,
        refunds: acc.refunds + r.refunds,
        expenses: acc.expenses + r.expenses,
        netProfit: acc.netProfit + r.netProfit,
      }),
      { revenue: 0, tax: 0, refunds: 0, expenses: 0, netProfit: 0 }
    );
    return { from: from ?? null, to: to ?? null, hotels: rows, totals };
  },
};
