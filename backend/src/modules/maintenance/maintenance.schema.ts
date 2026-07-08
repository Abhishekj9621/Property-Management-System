import { z } from "zod";

export const createMaintenanceRequestSchema = z.object({
  body: z.object({
    title: z.string().min(2),
    description: z.string().optional(),
    location: z.string().optional(),
    roomId: z.string().uuid().optional(),
    assetId: z.string().uuid().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
    assigneeId: z.string().uuid().optional(),
    estimatedCost: z.number().nonnegative().optional(),
  }),
});

export const updateMaintenanceRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    status: z.enum(["OPEN", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    estimatedCost: z.number().nonnegative().optional(),
    actualCost: z.number().nonnegative().optional(),
  }),
});

export const createAssetSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    category: z.string().min(1),
    serialNumber: z.string().optional(),
    location: z.string().optional(),
    purchaseDate: z.string().datetime().optional(),
    purchaseCost: z.number().nonnegative().optional(),
    warrantyExpiry: z.string().datetime().optional(),
    notes: z.string().optional(),
  }),
});

export const updateAssetSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).optional(),
    category: z.string().optional(),
    serialNumber: z.string().optional(),
    location: z.string().optional(),
    purchaseDate: z.string().datetime().optional(),
    purchaseCost: z.number().nonnegative().optional(),
    warrantyExpiry: z.string().datetime().optional(),
    status: z.enum(["IN_SERVICE", "UNDER_MAINTENANCE", "RETIRED", "DISPOSED"]).optional(),
    notes: z.string().optional(),
  }),
});
