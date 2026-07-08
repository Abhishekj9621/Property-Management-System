import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { ApiError } from "../../../utils/ApiError";
import { generateDocumentNumber, postLedgerEntry, assertPeriodOpen } from "../shared/ledger.helper";

const includeGraph = {
  lineItems: true,
  creditNotes: true,
  booking: { select: { id: true, bookingRef: true, checkInDate: true, checkOutDate: true, paidAmount: true, totalAmount: true } },
  guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
};

interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
}

function computeTotals(lineItems: LineItemInput[], discount: number) {
  let subtotal = 0;
  let tax = 0;
  const items = lineItems.map((li) => {
    const lineAmount = Number((li.quantity * li.unitPrice).toFixed(2));
    const lineTax = Number(((lineAmount * li.taxPercent) / 100).toFixed(2));
    subtotal += lineAmount;
    tax += lineTax;
    return { ...li, amount: lineAmount };
  });
  subtotal = Number(subtotal.toFixed(2));
  tax = Number(tax.toFixed(2));
  const total = Number((subtotal + tax - discount).toFixed(2));
  return { items, subtotal, tax, total };
}

/** Derives the guest-facing payment status for a fetched invoice purely
 * in-memory — never writes to the DB. Used by list/get so read endpoints
 * stay read-only (no write-on-read: that pattern is hostile to read
 * replicas and turns every "GET /invoices" into a potential burst of
 * per-row UPDATEs). The persisted `status`/`amountPaid` columns are kept
 * fresh instead by `syncInvoiceForBooking` below, called explicitly by the
 * Payments and Refunds modules at the moment a booking's paid amount
 * actually changes — an event-driven sync instead of a read-triggered one. */
function derivePaymentState(invoice: any) {
  if (invoice.status === "VOID" || invoice.status === "DRAFT") return invoice;

  const amountPaid = invoice.booking ? Number(invoice.booking.paidAmount) : Number(invoice.amountPaid);
  const total = Number(invoice.total);
  let status = invoice.status;
  if (amountPaid >= total && total > 0) status = "PAID";
  else if (amountPaid > 0) status = "PARTIALLY_PAID";
  else if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) status = "OVERDUE";
  else status = "ISSUED";

  if (status === invoice.status && (!invoice.booking || amountPaid === Number(invoice.amountPaid))) {
    return invoice;
  }
  return { ...invoice, status, amountPaid };
}

/**
 * Persists the derived payment status/amount for the invoice tied to a
 * booking, if one exists. Call this whenever a booking's `paidAmount`
 * changes outside the invoice's own issue/void flow — currently:
 * Payments.recordPayment (incl. the Stripe webhook path) and
 * Refunds.processRefund. A no-op if the booking has no invoice yet.
 */
export async function syncInvoiceForBooking(bookingId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const invoice = await (tx as any).invoice.findUnique({ where: { bookingId } });
  if (!invoice || invoice.status === "VOID" || invoice.status === "DRAFT") return;

  const booking = await (tx as any).booking.findUnique({ where: { id: bookingId }, select: { paidAmount: true } });
  if (!booking) return;

  const amountPaid = Number(booking.paidAmount);
  const total = Number(invoice.total);
  let status = invoice.status;
  if (amountPaid >= total && total > 0) status = "PAID";
  else if (amountPaid > 0) status = "PARTIALLY_PAID";
  else if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) status = "OVERDUE";
  else status = "ISSUED";

  if (status === invoice.status && amountPaid === Number(invoice.amountPaid)) return;

  await (tx as any).invoice.update({ where: { id: invoice.id }, data: { status, amountPaid } });
}

export const invoicesService = {
  async createInvoice(hotelId: string, createdById: string | undefined, data: any) {
    const { bookingId, guestId, type, asDraft, dueDate, notes, discount, lineItems } = data;

    let resolvedGuestId = guestId;
    if (bookingId) {
      const booking = await prisma.booking.findFirst({ where: { id: bookingId, hotelId } });
      if (!booking) throw ApiError.notFound("Booking not found for this hotel");
      resolvedGuestId = resolvedGuestId ?? booking.guestId;

      const existing = await prisma.invoice.findUnique({ where: { bookingId } });
      if (existing) throw ApiError.conflict(`Booking already has invoice ${existing.invoiceNumber}`);
    }

    const { items, subtotal, tax, total } = computeTotals(lineItems, discount ?? 0);
    const status = asDraft ? "DRAFT" : "ISSUED";
    const issuedAt = new Date();
    if (!asDraft) await assertPeriodOpen(hotelId, issuedAt);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const invoiceNumber = await generateDocumentNumber("INV", hotelId, tx);

      const invoice = await tx.invoice.create({
        data: {
          hotelId,
          bookingId: bookingId ?? undefined,
          guestId: resolvedGuestId ?? undefined,
          invoiceNumber,
          type,
          status,
          subtotal,
          tax,
          discount: discount ?? 0,
          total,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          notes,
          createdById,
          lineItems: { create: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, taxPercent: i.taxPercent, amount: i.amount })) },
        },
        include: includeGraph,
      });

      if (!asDraft) {
        await postLedgerEntry(
          {
            hotelId,
            type: "REVENUE",
            direction: "CREDIT",
            amount: subtotal,
            description: `Invoice ${invoiceNumber} issued`,
            sourceType: "INVOICE",
            sourceId: invoice.id,
            referenceCode: invoiceNumber,
            createdById,
            entryDate: issuedAt,
          },
          tx
        );
        if (tax > 0) {
          await postLedgerEntry(
            {
              hotelId,
              type: "TAX",
              direction: "CREDIT",
              amount: tax,
              description: `Tax collected on invoice ${invoiceNumber}`,
              sourceType: "INVOICE",
              sourceId: invoice.id,
              referenceCode: invoiceNumber,
              createdById,
              entryDate: issuedAt,
            },
            tx
          );
        }
        if (discount > 0) {
          await postLedgerEntry(
            {
              hotelId,
              type: "DISCOUNT",
              direction: "DEBIT",
              amount: discount,
              description: `Discount applied on invoice ${invoiceNumber}`,
              sourceType: "INVOICE",
              sourceId: invoice.id,
              referenceCode: invoiceNumber,
              createdById,
              entryDate: issuedAt,
            },
            tx
          );
        }
      }

      return invoice;
    });
  },

  async listInvoices(
    hotelId: string,
    filters: { status?: string; type?: string; guestId?: string; bookingId?: string; from?: string; to?: string; page?: number; limit?: number }
  ) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;

    const where: Prisma.InvoiceWhereInput = {
      hotelId,
      ...(filters.status ? { status: filters.status as any } : {}),
      ...(filters.type ? { type: filters.type as any } : {}),
      ...(filters.guestId ? { guestId: filters.guestId } : {}),
      ...(filters.bookingId ? { bookingId: filters.bookingId } : {}),
      ...(filters.from || filters.to
        ? {
            issuedAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const [rows, total, summary] = await Promise.all([
      prisma.invoice.findMany({ where, include: includeGraph, orderBy: { issuedAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.invoice.count({ where }),
      prisma.invoice.groupBy({ by: ["status"], where, _sum: { total: true } }),
    ]);

    const items = rows.map(derivePaymentState);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary: summary.map((s: any) => ({ status: s.status, total: Number(s._sum.total ?? 0) })),
    };
  },

  async getInvoice(hotelId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({ where: { id, hotelId }, include: includeGraph });
    if (!invoice) throw ApiError.notFound("Invoice not found");
    return derivePaymentState(invoice);
  },

  async updateDraft(hotelId: string, id: string, data: any) {
    const existing = await prisma.invoice.findFirst({ where: { id, hotelId }, include: { lineItems: true } });
    if (!existing) throw ApiError.notFound("Invoice not found");
    if (existing.status !== "DRAFT") throw ApiError.conflict("Only draft invoices can be edited");

    const lineItems =
      data.lineItems ??
      existing.lineItems.map((li: any) => ({
        description: li.description,
        quantity: Number(li.quantity),
        unitPrice: Number(li.unitPrice),
        taxPercent: Number(li.taxPercent),
      }));
    const discount = data.discount ?? Number(existing.discount);
    const { items, subtotal, tax, total } = computeTotals(lineItems, discount);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          subtotal,
          tax,
          discount,
          total,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          notes: data.notes ?? undefined,
          lineItems: { create: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, taxPercent: i.taxPercent, amount: i.amount })) },
        },
        include: includeGraph,
      });
    });
  },

  /** Transitions a PROFORMA/DRAFT invoice to ISSUED, generating a real
   * invoice number and posting the revenue/tax/discount ledger entries. */
  async issueInvoice(hotelId: string, id: string, actorId: string | undefined) {
    const existing = await prisma.invoice.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Invoice not found");
    if (existing.status !== "DRAFT") throw ApiError.conflict("Only draft invoices can be issued");

    const issuedAt = new Date();
    await assertPeriodOpen(hotelId, issuedAt);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const invoice = await tx.invoice.update({
        where: { id },
        data: { status: "ISSUED", issuedAt },
        include: includeGraph,
      });

      await postLedgerEntry(
        {
          hotelId,
          type: "REVENUE",
          direction: "CREDIT",
          amount: Number(invoice.subtotal),
          description: `Invoice ${invoice.invoiceNumber} issued`,
          sourceType: "INVOICE",
          sourceId: invoice.id,
          referenceCode: invoice.invoiceNumber,
          createdById: actorId,
          entryDate: issuedAt,
        },
        tx
      );
      if (Number(invoice.tax) > 0) {
        await postLedgerEntry(
          {
            hotelId,
            type: "TAX",
            direction: "CREDIT",
            amount: Number(invoice.tax),
            description: `Tax collected on invoice ${invoice.invoiceNumber}`,
            sourceType: "INVOICE",
            sourceId: invoice.id,
            referenceCode: invoice.invoiceNumber,
            createdById: actorId,
            entryDate: issuedAt,
          },
          tx
        );
      }

      return invoice;
    });
  },

  async voidInvoice(hotelId: string, id: string, actorId: string | undefined, reason: string) {
    const existing = await prisma.invoice.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Invoice not found");
    if (existing.status === "VOID") throw ApiError.conflict("Invoice is already void");
    if (existing.status === "PAID") {
      throw ApiError.conflict("A fully paid invoice cannot be voided — issue a credit note instead");
    }
    await assertPeriodOpen(hotelId, existing.issuedAt);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const invoice = await tx.invoice.update({
        where: { id },
        data: { status: "VOID", voidedAt: new Date(), voidReason: reason },
        include: includeGraph,
      });

      if (existing.status !== "DRAFT") {
        // Reverse the originally-posted revenue with an offsetting adjustment.
        await postLedgerEntry(
          {
            hotelId,
            type: "ADJUSTMENT",
            direction: "DEBIT",
            amount: Number(existing.subtotal) + Number(existing.tax),
            description: `Invoice ${existing.invoiceNumber} voided — ${reason}`,
            sourceType: "INVOICE",
            sourceId: invoice.id,
            referenceCode: invoice.invoiceNumber,
            createdById: actorId,
          },
          tx
        );
      }

      return invoice;
    });
  },

  /** Marks an ad-hoc (non-booking) invoice as paid outside the Payments
   * module's booking-based flow — e.g. a corporate/banquet invoice settled
   * by bank transfer against no specific booking. */
  async markAdhocInvoicePaid(hotelId: string, id: string) {
    const existing = await prisma.invoice.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Invoice not found");
    if (existing.bookingId) throw ApiError.badRequest("Booking-linked invoices are marked paid automatically from booking payments");
    if (["VOID", "DRAFT"].includes(existing.status)) throw ApiError.conflict(`Cannot mark a ${existing.status} invoice as paid`);

    return prisma.invoice.update({
      where: { id },
      data: { status: "PAID", amountPaid: existing.total },
      include: includeGraph,
    });
  },
};
