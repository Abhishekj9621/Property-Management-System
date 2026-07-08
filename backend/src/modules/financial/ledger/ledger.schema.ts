import { z } from "zod";

export const createManualEntrySchema = z.object({
  body: z.object({
    type: z.enum(["REVENUE", "TAX", "DISCOUNT", "REFUND", "EXPENSE", "ADJUSTMENT"]),
    direction: z.enum(["DEBIT", "CREDIT"]),
    amount: z.number().positive(),
    description: z.string().min(3).max(500),
    entryDate: z.string().datetime().optional(),
  }),
});

export const listLedgerSchema = z.object({
  query: z.object({
    type: z.enum(["REVENUE", "TAX", "DISCOUNT", "REFUND", "EXPENSE", "ADJUSTMENT"]).optional(),
    direction: z.enum(["DEBIT", "CREDIT"]).optional(),
    sourceType: z.enum(["BOOKING", "INVOICE", "PAYMENT", "EXPENSE", "REFUND", "CREDIT_NOTE", "MANUAL"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
  }),
});
