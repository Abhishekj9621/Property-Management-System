import { z } from "zod";

export const dateRangeSchema = z.object({
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});
