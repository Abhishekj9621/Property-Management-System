import { z } from "zod";

export const createRecurringExpenseSchema = z.object({
  body: z.object({
    title: z.string().min(2),
    description: z.string().optional(),
    amount: z.number().positive(),
    categoryId: z.string().uuid().optional(),
    vendorId: z.string().uuid().optional(),
    isReimbursable: z.boolean().default(false),
    frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
  }),
});

export const updateRecurringExpenseSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    amount: z.number().positive().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    vendorId: z.string().uuid().nullable().optional(),
    isReimbursable: z.boolean().optional(),
    endDate: z.string().datetime().nullable().optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
