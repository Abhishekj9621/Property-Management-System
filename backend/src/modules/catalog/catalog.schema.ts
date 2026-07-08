import { z } from "zod";

export const createHotelTypeSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    code: z
      .string()
      .min(1)
      .regex(/^[A-Z0-9_]+$/, "Code must be UPPER_SNAKE_CASE"),
    description: z.string().optional(),
    icon: z.string().optional(),
    sortOrder: z.number().int().optional(),
  }),
});
export const updateHotelTypeSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: createHotelTypeSchema.shape.body.partial().extend({
    isActive: z.boolean().optional(),
  }),
});

export const createRoomCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    code: z
      .string()
      .min(1)
      .regex(/^[A-Z0-9_]+$/, "Code must be UPPER_SNAKE_CASE"),
    description: z.string().optional(),
    sortOrder: z.number().int().optional(),
  }),
});
export const updateRoomCategorySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: createRoomCategorySchema.shape.body.partial().extend({
    isActive: z.boolean().optional(),
  }),
});
