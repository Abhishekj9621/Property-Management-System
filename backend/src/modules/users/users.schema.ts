import { z } from "zod";

const roleEnum = z.enum(["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"]);

export const createStaffSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    role: roleEnum,
    // Required for every role except SUPER_ADMIN (enforced in the service,
    // since SUPER_ADMIN accounts are platform-level and carry no hotelId).
    hotelId: z.string().uuid().optional(),
  }),
});

export const updateStaffSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().optional(),
    role: roleEnum.optional(),
    hotelId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const resetStaffPasswordSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  }),
});

export const listStaffQuerySchema = z.object({
  query: z.object({
    hotelId: z.string().uuid().optional(),
    role: roleEnum.optional(),
    includeInactive: z.string().optional(),
    search: z.string().optional(),
  }),
});
