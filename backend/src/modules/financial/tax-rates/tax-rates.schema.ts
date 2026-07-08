import { z } from "zod";

export const createTaxRateSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    code: z.string().max(30).optional(),
    percentage: z.number().min(0).max(100),
    isDefault: z.boolean().default(false),
  }),
});

export const updateTaxRateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    code: z.string().max(30).optional(),
    percentage: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
