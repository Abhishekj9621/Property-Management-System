import { z } from "zod";

export const createTaskSchema = z.object({
  body: z.object({
    roomId: z.string().uuid(),
    type: z.enum(["CHECKOUT_CLEAN", "TURNDOWN", "MAINTENANCE", "DEEP_CLEAN", "INSPECTION"]),
    assigneeId: z.string().uuid().optional(),
    priority: z.number().int().min(1).max(5).default(1),
    notes: z.string().optional(),
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "VERIFIED"]).optional(),
    assigneeId: z.string().uuid().optional(),
    notes: z.string().optional(),
  }),
});
