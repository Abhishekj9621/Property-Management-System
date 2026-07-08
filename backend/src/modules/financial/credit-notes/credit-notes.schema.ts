import { z } from "zod";

export const createCreditNoteSchema = z.object({
  body: z.object({
    invoiceId: z.string().uuid(),
    amount: z.number().positive(),
    reason: z.string().min(3).max(500),
  }),
});

export const listCreditNotesSchema = z.object({
  query: z.object({
    invoiceId: z.string().uuid().optional(),
    status: z.enum(["ISSUED", "VOID"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
