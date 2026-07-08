import { z } from "zod";

export const createPaymentSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid(),
    amount: z.number().positive(),
    method: z.enum(["CARD", "CASH", "BANK_TRANSFER", "WALLET"]),
  }),
});

export const createPaymentIntentSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid(),
    amount: z.number().positive(),
  }),
});
