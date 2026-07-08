import { z } from "zod";

export const createBudgetSchema = z.object({
  body: z.object({
    categoryId: z.string().uuid().optional(),
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(1).max(12).optional(),
    amount: z.number().positive(),
    alertThresholdPercent: z.number().int().min(1).max(100).default(90),
  }),
});

export const updateBudgetSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    amount: z.number().positive().optional(),
    alertThresholdPercent: z.number().int().min(1).max(100).optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const listBudgetsSchema = z.object({
  query: z.object({
    year: z.coerce.number().int().optional(),
    month: z.coerce.number().int().optional(),
    categoryId: z.string().uuid().optional(),
  }),
});
