import { z } from "zod";

const lineItemSchema = z.object({
  description: z.string().min(1).max(255),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().nonnegative(),
  taxPercent: z.number().min(0).max(100).default(0),
});

export const createInvoiceSchema = z.object({
  body: z
    .object({
      bookingId: z.string().uuid().optional(),
      guestId: z.string().uuid().optional(),
      type: z.enum(["STANDARD", "PROFORMA"]).default("STANDARD"),
      asDraft: z.boolean().default(false),
      dueDate: z.string().datetime().optional(),
      notes: z.string().max(2000).optional(),
      discount: z.number().nonnegative().default(0),
      lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
    })
    .refine((data) => data.bookingId || data.guestId, {
      message: "Either bookingId or guestId is required for an invoice",
      path: ["bookingId"],
    }),
});

export const updateInvoiceDraftSchema = z.object({
  body: z.object({
    dueDate: z.string().datetime().optional(),
    notes: z.string().max(2000).optional(),
    discount: z.number().nonnegative().optional(),
    lineItems: z.array(lineItemSchema).min(1).optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
});

export const voidInvoiceSchema = z.object({
  body: z.object({
    reason: z.string().min(3, "A void reason is required").max(500),
  }),
  params: z.object({ id: z.string().uuid() }),
});

export const listInvoicesSchema = z.object({
  query: z.object({
    status: z.enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"]).optional(),
    type: z.enum(["STANDARD", "PROFORMA"]).optional(),
    guestId: z.string().uuid().optional(),
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
