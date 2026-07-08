import Stripe from "stripe";
import { prisma } from "../../config/database";
import { Prisma } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { recordAudit, AuditActions } from "../../lib/auditLog";
import { syncInvoiceForBooking } from "../financial/invoices/invoices.service";

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any }) : null;

export const paymentsService = {
  /**
   * Creates a Stripe PaymentIntent for a booking balance. Returns the client
   * secret for the frontend to confirm via Stripe.js/Elements.
   */
  async createPaymentIntent(hotelId: string, bookingId: string, amount: number) {
    if (!stripe) throw ApiError.internal("Stripe is not configured on this server");
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, hotelId }, include: { hotel: true } });
    if (!booking) throw ApiError.notFound("Booking not found");

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "inr",
      metadata: { bookingId },
      automatic_payment_methods: { enabled: true },
    });

    return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
  },

  /**
   * Records a manual/offline payment (cash, bank transfer) against a booking.
   * Uses an atomic increment (rather than read-then-write) so concurrent
   * payments against the same booking can never clobber each other, and
   * flags the booking as fully paid once paidAmount reaches totalAmount.
   *
   * `stripePaymentId`, when provided (webhook path only), makes this
   * idempotent against Stripe's at-least-once webhook delivery — retried
   * deliveries for a PaymentIntent that was already recorded return the
   * existing payment instead of crediting the booking a second time.
   */
  async recordPayment(
    hotelId: string,
    bookingId: string,
    amount: number,
    method: "CARD" | "CASH" | "BANK_TRANSFER" | "WALLET",
    options: { stripePaymentId?: string; actorId?: string | null } = {}
  ) {
    if (!amount || amount <= 0) throw ApiError.badRequest("Payment amount must be greater than zero");

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const booking = await tx.booking.findFirst({ where: { id: bookingId, hotelId }, include: { guest: true, hotel: true } });
      if (!booking) throw ApiError.notFound("Booking not found");

      if (options.stripePaymentId) {
        const existing = await tx.payment.findFirst({ where: { stripePaymentId: options.stripePaymentId } });
        if (existing) {
          return {
            payment: { ...existing, hotelId: booking.hotelId, guest: booking.guest, hotel: booking.hotel, bookingRef: booking.bookingRef },
            duplicate: true,
          };
        }
      }

      const payment = await tx.payment.create({
        data: { bookingId, amount, method, status: "PAID", paidAt: new Date(), stripePaymentId: options.stripePaymentId },
      });

      // Atomic increment avoids a lost-update race if two payments land
      // for the same booking at nearly the same time.
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { paidAmount: { increment: amount } },
      });

      // Keep the Financial Management module's invoice (if this booking has
      // one) in sync with the new paid amount — event-driven, right at the
      // moment the booking's paidAmount actually changes, rather than
      // recomputed on every invoice read.
      await syncInvoiceForBooking(bookingId, tx);

      return {
        payment: {
          ...payment,
          hotelId: booking.hotelId,
          guest: booking.guest,
          hotel: booking.hotel,
          bookingRef: booking.bookingRef,
          bookingPaidAmount: updatedBooking.paidAmount,
          bookingTotalAmount: updatedBooking.totalAmount,
          isFullyPaid: Number(updatedBooking.paidAmount) >= Number(updatedBooking.totalAmount),
        },
        duplicate: false,
      };
    });

    if (result.duplicate) {
      logger.info(`Ignored duplicate payment record attempt for stripePaymentId=${options.stripePaymentId} (already recorded)`);
      await recordAudit({
        userId: options.actorId ?? null,
        action: AuditActions.PAYMENT_WEBHOOK_DUPLICATE_IGNORED,
        entity: "Payment",
        entityId: result.payment.id,
        metadata: { bookingId, stripePaymentId: options.stripePaymentId },
      });
      return result.payment;
    }

    await recordAudit({
      userId: options.actorId ?? null,
      action: AuditActions.PAYMENT_RECORDED,
      entity: "Payment",
      entityId: result.payment.id,
      metadata: { bookingId, amount, method, viaWebhook: !!options.stripePaymentId },
    });

    return result.payment;
  },

  async listPaymentsForBooking(hotelId: string, bookingId: string) {
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, hotelId }, select: { id: true } });
    if (!booking) throw ApiError.notFound("Booking not found");
    return prisma.payment.findMany({ where: { bookingId }, orderBy: { createdAt: "desc" } });
  },

  /**
   * Hotel-scoped payment ledger, used by the Revenue dashboard. Supports
   * optional date-range filtering and returns both the page of transactions
   * and summary totals (by payment method) for the full filtered set.
   */
  async listPaymentsForHotel(
    hotelId: string,
    filters: { from?: string; to?: string; page?: number; limit?: number } = {}
  ) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;

    const where: Prisma.PaymentWhereInput = {
      status: "PAID",
      booking: { hotelId },
      ...(filters.from || filters.to
        ? {
            paidAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total, allForSummary] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { booking: { include: { guest: true } } },
        orderBy: { paidAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
      prisma.payment.findMany({ where, select: { amount: true, method: true } }),
    ]);

    const totalRevenue = allForSummary.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const byMethod: Record<string, number> = {};
    for (const p of allForSummary) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary: { totalRevenue, byMethod },
    };
  },

  /** Handles Stripe webhook events (payment_intent.succeeded, etc.) */
  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    if (!stripe) throw ApiError.internal("Stripe is not configured");
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.error("Stripe webhook signature verification failed", err);
      throw ApiError.badRequest("Invalid Stripe signature");
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const bookingId = intent.metadata.bookingId;
      if (bookingId) {
        // Stripe metadata is trusted here since it was set by us when the
        // intent was created; resolve the owning hotel so recordPayment's
        // tenant scoping still applies for webhook-originated payments.
        const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { hotelId: true } });
        if (!booking) throw ApiError.notFound("Booking not found for webhook payment");
        const payment = await this.recordPayment(booking.hotelId, bookingId, intent.amount / 100, "CARD", { stripePaymentId: intent.id });
        return { received: true, payment };
      }
    }

    return { received: true };
  },
};
