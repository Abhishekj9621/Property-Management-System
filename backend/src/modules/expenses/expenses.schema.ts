import { z } from "zod";

export const createExpenseSchema = z.object({
  body: z.object({
    title: z.string().min(2),
    description: z.string().optional(),
    amount: z.number().positive(),
    vendor: z.string().optional(),
    vendorId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    isReimbursable: z.boolean().default(false),
    receiptUrl: z.string().url().optional(),
    attachments: z.array(z.object({ url: z.string().url(), fileName: z.string().optional() })).optional(),
    expenseDate: z.string().datetime().optional(),
  }),
});

export const updateExpenseSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    amount: z.number().positive().optional(),
    vendor: z.string().optional(),
    vendorId: z.string().uuid().nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    isReimbursable: z.boolean().optional(),
    receiptUrl: z.string().url().optional(),
    expenseDate: z.string().datetime().optional(),
  }),
});

export const addAttachmentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    url: z.string().url(),
    fileName: z.string().optional(),
  }),
});

export const decideExpenseSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(["APPROVED", "REJECTED", "REIMBURSED", "PAID"]),
    rejectionReason: z.string().optional(),
    paymentMethod: z.enum(["CARD", "CASH", "BANK_TRANSFER", "WALLET"]).optional(),
    paymentReference: z.string().optional(),
  }),
});

export const createExpenseCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2),
    code: z.string().optional(),
  }),
});

export const updateExpenseCategorySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).optional(),
    code: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
