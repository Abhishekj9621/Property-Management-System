import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import { ApiResponse } from "../../../utils/ApiResponse";
import { requireHotelId } from "../../../utils/requestHotel";
import { recurringExpenseService } from "./recurring.service";
import { recordAudit, AuditActions } from "../../../lib/auditLog";

export const recurringExpenseController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === "true";
    const items = await recurringExpenseService.list(requireHotelId(req), includeInactive);
    res.status(200).json(new ApiResponse("Recurring expenses fetched", items));
  }),

  get: catchAsync(async (req: Request, res: Response) => {
    const item = await recurringExpenseService.get(requireHotelId(req), req.params.id);
    res.status(200).json(new ApiResponse("Recurring expense fetched", item));
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const item = await recurringExpenseService.create(hotelId, req.user?.id, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.RECURRING_EXPENSE_CREATED, entity: "RecurringExpense", entityId: item.id, metadata: { title: item.title }, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("recurring-expense:created", item);
    res.status(201).json(new ApiResponse("Recurring expense created", item));
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const item = await recurringExpenseService.update(hotelId, req.params.id, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.RECURRING_EXPENSE_UPDATED, entity: "RecurringExpense", entityId: item.id, metadata: req.body, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("recurring-expense:updated", item);
    res.status(200).json(new ApiResponse("Recurring expense updated", item));
  }),

  pause: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const item = await recurringExpenseService.setActive(hotelId, req.params.id, false);
    await recordAudit({ userId: req.user?.id, action: AuditActions.RECURRING_EXPENSE_PAUSED, entity: "RecurringExpense", entityId: item.id, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("recurring-expense:updated", item);
    res.status(200).json(new ApiResponse("Recurring expense paused", item));
  }),

  resume: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const item = await recurringExpenseService.setActive(hotelId, req.params.id, true);
    await recordAudit({ userId: req.user?.id, action: AuditActions.RECURRING_EXPENSE_RESUMED, entity: "RecurringExpense", entityId: item.id, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("recurring-expense:updated", item);
    res.status(200).json(new ApiResponse("Recurring expense resumed", item));
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const result = await recurringExpenseService.remove(hotelId, req.params.id);
    await recordAudit({ userId: req.user?.id, action: AuditActions.RECURRING_EXPENSE_DELETED, entity: "RecurringExpense", entityId: result.id, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("recurring-expense:deleted", result);
    res.status(200).json(new ApiResponse("Recurring expense deleted", result));
  }),
};
