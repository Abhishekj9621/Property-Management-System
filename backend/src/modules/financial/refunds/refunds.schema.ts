import { z } from "zod";

export const requestRefundSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid(),
    paymentId: z.string().uuid().optional(),
    amount: z.number().positive(),
    reason: z.string().min(3).max(500),
    method: z.enum(["CARD", "CASH", "BANK_TRANSFER", "WALLET"]),
  }),
});

export const decideRefundSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().max(500).optional(),
  }),
});

export const processRefundSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    transactionRef: z.string().max(120).optional(),
  }),
});

export const listRefundsSchema = z.object({
  query: z.object({
    status: z.enum(["REQUESTED", "APPROVED", "REJECTED", "PROCESSED"]).optional(),
    bookingId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
