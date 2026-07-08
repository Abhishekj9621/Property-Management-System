import { z } from "zod";

export const dateRangeSchema = z.object({
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

export const dailyCashSchema = z.object({
  query: z.object({
    date: z.string().min(10, "date (YYYY-MM-DD) is required"),
  }),
});
