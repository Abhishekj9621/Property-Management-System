import { z } from "zod";

export const createGuestSchema = z.object({
  body: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    idType: z.string().optional(),
    idNumber: z.string().optional(),
    nationality: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const updateGuestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: createGuestSchema.shape.body.partial(),
});
