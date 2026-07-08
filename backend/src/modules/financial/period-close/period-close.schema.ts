import { z } from "zod";

export const previewCloseSchema = z.object({
  query: z.object({
    businessDate: z.string().min(10, "businessDate (YYYY-MM-DD) is required"),
  }),
});

export const closeDaySchema = z.object({
  body: z.object({
    businessDate: z.string().min(10, "businessDate (YYYY-MM-DD) is required"),
    notes: z.string().max(1000).optional(),
  }),
});

export const reopenDaySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    reason: z.string().min(3).max(500),
  }),
});

export const listClosesSchema = z.object({
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});
