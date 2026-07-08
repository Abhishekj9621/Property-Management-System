import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { paymentsService } from "./payments.service";
import { requireHotelId } from "../../utils/requestHotel";
import { sendMail, emailTemplates } from "../../utils/mailer";

function fmtMoney(amount: number) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `₹${amount.toFixed(2)}`;
  }
}

async function sendReceiptEmail(payment: any) {
  if (!payment?.guest?.email) return;
  const tpl = emailTemplates.paymentReceipt({
    guestName: `${payment.guest.firstName} ${payment.guest.lastName}`,
    hotelName: payment.hotel?.name ?? "your hotel",
    bookingRef: payment.bookingRef,
    amount: fmtMoney(Number(payment.amount)),
    method: payment.method,
  });
  await sendMail({ to: payment.guest.email, ...tpl });
}

export const paymentsController = {
  listForHotel: catchAsync(async (req: Request, res: Response) => {
    const { from, to, page, limit } = req.query;
    const result = await paymentsService.listPaymentsForHotel(requireHotelId(req), {
      from: from as string,
      to: to as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(
      new ApiResponse("Payments fetched", result.items, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        summary: result.summary,
      })
    );
  }),

  createIntent: catchAsync(async (req: Request, res: Response) => {
    const result = await paymentsService.createPaymentIntent(requireHotelId(req), req.body.bookingId, req.body.amount);
    res.status(201).json(new ApiResponse("Payment intent created", result));
  }),

  recordPayment: catchAsync(async (req: Request, res: Response) => {
    const payment = await paymentsService.recordPayment(requireHotelId(req), req.body.bookingId, req.body.amount, req.body.method, {
      actorId: req.user?.id,
    });
    if (payment.hotelId) req.app.get("io")?.to(`hotel:${payment.hotelId}`).emit("payment:recorded", payment);
    await sendReceiptEmail(payment);
    res.status(201).json(new ApiResponse("Payment recorded", payment));
  }),

  listForBooking: catchAsync(async (req: Request, res: Response) => {
    const payments = await paymentsService.listPaymentsForBooking(requireHotelId(req), req.params.bookingId);
    res.status(200).json(new ApiResponse("Payments fetched", payments));
  }),

  webhook: catchAsync(async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"] as string;
    const result = await paymentsService.handleStripeWebhook(req.body, signature);
    if (result.payment?.hotelId) {
      req.app.get("io")?.to(`hotel:${result.payment.hotelId}`).emit("payment:recorded", result.payment);
      await sendReceiptEmail(result.payment);
    }
    res.status(200).json(result);
  }),
};
