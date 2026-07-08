import { z } from "zod";

export const createVendorSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(150),
    contactName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    taxId: z.string().optional(),
    paymentTerms: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const updateVendorSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).max(150).optional(),
    contactName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    taxId: z.string().optional(),
    paymentTerms: z.string().optional(),
    notes: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
