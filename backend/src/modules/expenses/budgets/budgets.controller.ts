import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import { ApiResponse } from "../../../utils/ApiResponse";
import { requireHotelId } from "../../../utils/requestHotel";
import { budgetsService } from "./budgets.service";
import { recordAudit, AuditActions } from "../../../lib/auditLog";

export const budgetsController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const { year, month, categoryId } = req.query as Record<string, string>;
    const budgets = await budgetsService.list(hotelId, { year: year ? Number(year) : undefined, month: month ? Number(month) : undefined, categoryId });
    res.status(200).json(new ApiResponse("Budgets fetched", budgets));
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const budget = await budgetsService.create(hotelId, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.EXPENSE_BUDGET_CREATED, entity: "ExpenseBudget", entityId: budget.id, metadata: req.body, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("expense-budget:created", budget);
    res.status(201).json(new ApiResponse("Budget created", budget));
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const budget = await budgetsService.update(hotelId, req.params.id, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.EXPENSE_BUDGET_UPDATED, entity: "ExpenseBudget", entityId: budget.id, metadata: req.body, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("expense-budget:updated", budget);
    res.status(200).json(new ApiResponse("Budget updated", budget));
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const result = await budgetsService.remove(hotelId, req.params.id);
    await recordAudit({ userId: req.user?.id, action: AuditActions.EXPENSE_BUDGET_DELETED, entity: "ExpenseBudget", entityId: result.id, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("expense-budget:deleted", result);
    res.status(200).json(new ApiResponse("Budget deleted", result));
  }),
};
