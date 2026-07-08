import { z } from "zod";

export const createRoomTypeSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    code: z.string().optional(),
    description: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    basePrice: z.number().positive(),
    weekendPrice: z.number().positive().optional(),
    extraBedPrice: z.number().nonnegative().optional(),
    taxPercent: z.number().min(0).max(100).default(10),
    discountPercent: z.number().min(0).max(100).default(0),
    minOccupancy: z.number().int().positive().default(1),
    maxOccupancy: z.number().int().positive().default(2),
    bedType: z.string().optional(),
    sizeSqft: z.number().int().positive().optional(),
    amenities: z.array(z.string()).default([]),
    images: z.array(z.string()).default([]),
  }),
});

export const createRoomSchema = z.object({
  body: z.object({
    roomTypeId: z.string().uuid(),
    roomNumber: z.string().min(1),
    floor: z.number().int(),
    view: z.string().optional(),
    smokingAllowed: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

export const updateRoomTypeSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: createRoomTypeSchema.shape.body.partial().extend({ isActive: z.boolean().optional() }),
});

export const updateRoomSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    roomTypeId: z.string().uuid().optional(),
    roomNumber: z.string().min(1).optional(),
    floor: z.number().int().optional(),
    view: z.string().optional(),
    smokingAllowed: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

export const updateRoomStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      "AVAILABLE",
      "RESERVED",
      "OCCUPIED",
      "DIRTY",
      "CLEANING",
      "MAINTENANCE",
      "OUT_OF_SERVICE",
    ]),
  }),
  params: z.object({ id: z.string().uuid() }),
});

export const bulkCreateRoomsSchema = z.object({
  body: z.object({
    roomTypeId: z.string().uuid(),
    floor: z.number().int(),
    startNumber: z.number().int().nonnegative(),
    count: z.number().int().min(1).max(200),
    prefix: z.string().optional(),
    view: z.string().optional(),
    smokingAllowed: z.boolean().optional(),
  }),
});

export const availabilityQuerySchema = z.object({
  query: z.object({
    checkInDate: z.string().datetime().or(z.string().min(1)),
    checkOutDate: z.string().datetime().or(z.string().min(1)),
    adults: z.string().optional(),
  }),
});
