import { z } from "zod";

export const contactFormSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    subject: z.string().optional(),
    message: z.string().min(1),
  }),
});
