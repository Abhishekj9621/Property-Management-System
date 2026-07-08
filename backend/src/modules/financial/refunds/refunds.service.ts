import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { ApiError } from "../../../utils/ApiError";
import { postLedgerEntry, assertPeriodOpen } from "../shared/ledger.helper";
import { syncInvoiceForBooking } from "../invoices/invoices.service";

const includeGraph = {
  booking: { select: { id: true, bookingRef: true, paidAmount: true, totalAmount: true, guest: { select: { firstName: true, lastName: true, email: true } } } },
  payment: { select: { id: true, amount: true, method: true, status: true } },
  requestedBy: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
};

export const refundsService = {
  async requestRefund(hotelId: string, requestedById: string | undefined, data: { bookingId: string; paymentId?: string; amount: number; reason: string; method: string }) {
    const booking = await prisma.booking.findFirst({ where: { id: data.bookingId, hotelId } });
    if (!booking) throw ApiError.notFound("Booking not found");

    if (data.paymentId) {
      const payment = await prisma.payment.findFirst({ where: { id: data.paymentId, bookingId: data.bookingId } });
      if (!payment) throw ApiError.notFound("Payment not found for this booking");
      if (payment.status !== "PAID") throw ApiError.badRequest("Only a completed payment can be refunded");
    }

    const alreadyRefundedOrPending = await prisma.refund.aggregate({
      where: { bookingId: data.bookingId, status: { in: ["REQUESTED", "APPROVED", "PROCESSED"] } },
      _sum: { amount: true },
    });
    const committed = Number(alreadyRefundedOrPending._sum.amount ?? 0);
    if (committed + data.amount > Number(booking.paidAmount)) {
      throw ApiError.badRequest(
        `Refund amount exceeds refundable balance. Paid: ${booking.paidAmount}, already requested/refunded: ${committed}`
      );
    }

    return prisma.refund.create({
      data: {
        hotelId,
        bookingId: data.bookingId,
        paymentId: data.paymentId,
        amount: data.amount,
        reason: data.reason,
        method: data.method as any,
        requestedById,
      },
      include: includeGraph,
    });
  },

  async listRefunds(hotelId: string, filters: { status?: string; bookingId?: string; from?: string; to?: string; page?: number; limit?: number }) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;
    const where: Prisma.RefundWhereInput = {
      hotelId,
      ...(filters.status ? { status: filters.status as any } : {}),
      ...(filters.bookingId ? { bookingId: filters.bookingId } : {}),
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } }
        : {}),
    };
    const [items, total, summary] = await Promise.all([
      prisma.refund.findMany({ where, include: includeGraph, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.refund.count({ where }),
      prisma.refund.groupBy({ by: ["status"], where, _sum: { amount: true } }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary: summary.map((s: any) => ({ status: s.status, total: Number(s._sum.amount ?? 0) })),
    };
  },

  async getRefund(hotelId: string, id: string) {
    const refund = await prisma.refund.findFirst({ where: { id, hotelId }, include: includeGraph });
    if (!refund) throw ApiError.notFound("Refund not found");
    return refund;
  },

  async decideRefund(hotelId: string, id: string, approverId: string | undefined, status: "APPROVED" | "REJECTED", rejectionReason?: string) {
    const existing = await prisma.refund.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Refund not found");
    if (existing.status !== "REQUESTED") throw ApiError.conflict(`Only requested refunds can be decided (current status: ${existing.status})`);
    if (status === "REJECTED" && !rejectionReason) throw ApiError.badRequest("rejectionReason is required when rejecting a refund");

    return prisma.refund.update({
      where: { id },
      data: { status, approvedById: approverId, rejectionReason: status === "REJECTED" ? rejectionReason : null },
      include: includeGraph,
    });
  },

  /** Marks the refund as money actually returned to the guest: decrements
   * the booking's paidAmount, flips the source Payment to REFUNDED when
   * the full payment amount is being returned, and posts the ledger entry. */
  async processRefund(hotelId: string, id: string, actorId: string | undefined, transactionRef?: string) {
    const existing = await prisma.refund.findFirst({ where: { id, hotelId }, include: { booking: true, payment: true } });
    if (!existing) throw ApiError.notFound("Refund not found");
    if (existing.status !== "APPROVED") throw ApiError.conflict("Only approved refunds can be processed");

    const processedAt = new Date();
    await assertPeriodOpen(hotelId, processedAt);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const refund = await tx.refund.update({
        where: { id },
        data: { status: "PROCESSED", processedAt, transactionRef },
        include: includeGraph,
      });

      await tx.booking.update({
        where: { id: existing.bookingId },
        data: { paidAmount: { decrement: existing.amount } },
      });

      // Keep the invoice tied to this booking (if any) in sync now that
      // its effective paid amount has gone down — otherwise a refunded
      // invoice could keep showing PAID after money was returned.
      await syncInvoiceForBooking(existing.bookingId, tx);

      if (existing.paymentId && existing.payment && Number(existing.amount) >= Number(existing.payment.amount)) {
        await tx.payment.update({ where: { id: existing.paymentId }, data: { status: "REFUNDED" } });
      }

      await postLedgerEntry(
        {
          hotelId,
          type: "REFUND",
          direction: "DEBIT",
          amount: Number(existing.amount),
          description: `Refund processed for booking ${existing.booking?.bookingRef ?? existing.bookingId} — ${existing.reason}`,
          sourceType: "REFUND",
          sourceId: refund.id,
          createdById: actorId,
          entryDate: processedAt,
        },
        tx
      );

      return refund;
    });
  },
};
