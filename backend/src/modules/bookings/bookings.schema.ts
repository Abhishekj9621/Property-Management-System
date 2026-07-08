import { z } from "zod";

export const createBookingSchema = z.object({
  body: z.object({
    guestId: z.string().uuid().optional(),
    guest: z
      .object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
      })
      .optional(),
    checkInDate: z.string().min(1),
    checkOutDate: z.string().min(1),
    adults: z.number().int().positive().default(1),
    children: z.number().int().min(0).default(0),
    roomIds: z.array(z.string().uuid()).min(1),
    specialRequests: z.string().optional(),
    source: z.string().default("DIRECT"),
    discountAmount: z.number().min(0).default(0),
  }).refine((data) => data.guestId || data.guest, {
    message: "Either guestId or inline guest details must be provided",
  }),
});

export const updateBookingStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"]),
    cancellationReason: z.string().optional(),
  }),
});

export const amendBookingSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      checkInDate: z.string().min(1).optional(),
      checkOutDate: z.string().min(1).optional(),
      roomIds: z.array(z.string().uuid()).min(1).optional(),
      adults: z.number().int().positive().optional(),
      children: z.number().int().min(0).optional(),
      specialRequests: z.string().optional(),
      discountAmount: z.number().min(0).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Provide at least one field to amend" }),
});

export const listBookingsQuerySchema = z.object({
  query: z.object({
    status: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
