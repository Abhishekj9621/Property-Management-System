import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { expensesService } from "./expenses.service";
import { requireHotelId } from "../../utils/requestHotel";
import { recordAudit, AuditActions } from "../../lib/auditLog";
import { EXPENSE_MANAGERS } from "./shared/expense.roles";

const statusToAction: Record<string, string> = {
  APPROVED: AuditActions.EXPENSE_APPROVED,
  REJECTED: AuditActions.EXPENSE_REJECTED,
  REIMBURSED: AuditActions.EXPENSE_REIMBURSED,
  PAID: AuditActions.EXPENSE_PAID,
};

export const expensesController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const expense = await expensesService.createExpense(hotelId, req.user?.id, req.body);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.EXPENSE_CREATED,
      entity: "Expense",
      entityId: expense.id,
      metadata: { title: expense.title, amount: expense.amount },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("expense:created", expense);
    res.status(201).json(new ApiResponse("Expense submitted", expense));
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const { status, isReimbursable, submittedById, vendorId, categoryId, from, to, page, limit } = req.query;
    const hotelId = requireHotelId(req);
    // Non-managers only ever see their own claims.
    const scopedSubmittedById = req.user && !EXPENSE_MANAGERS.includes(req.user.role) ? req.user.id : (submittedById as string);
    const result = await expensesService.listExpenses(hotelId, {
      status: status as string,
      isReimbursable: isReimbursable as string,
      submittedById: scopedSubmittedById,
      vendorId: vendorId as string,
      categoryId: categoryId as string,
      from: from as string,
      to: to as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(
      new ApiResponse("Expenses fetched", result.items, {
        total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages, summary: result.summary,
      })
    );
  }),

  get: catchAsync(async (req: Request, res: Response) => {
    const expense = await expensesService.getExpense(requireHotelId(req), req.params.id);
    const isManager = !!req.user && EXPENSE_MANAGERS.includes(req.user.role);
    if (!isManager && expense.submittedById !== req.user?.id) {
      return res.status(403).json(new ApiResponse("You do not have access to this expense", null));
    }
    res.status(200).json(new ApiResponse("Expense fetched", expense));
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const isManager = !!req.user && EXPENSE_MANAGERS.includes(req.user.role);
    const expense = await expensesService.updateExpense(hotelId, req.params.id, req.user?.id, isManager, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.EXPENSE_UPDATED, entity: "Expense", entityId: expense.id, metadata: req.body, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("expense:updated", expense);
    res.status(200).json(new ApiResponse("Expense updated", expense));
  }),

  addAttachment: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const expense = await expensesService.addAttachment(hotelId, req.params.id, req.user?.id, req.body.url, req.body.fileName);
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("expense:updated", expense);
    res.status(201).json(new ApiResponse("Attachment added", expense));
  }),

  removeAttachment: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const expense = await expensesService.removeAttachment(hotelId, req.params.id, req.params.attachmentId);
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("expense:updated", expense);
    res.status(200).json(new ApiResponse("Attachment removed", expense));
  }),

  decide: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const { status, rejectionReason, paymentMethod, paymentReference } = req.body;
    const expense = await expensesService.decideExpense(hotelId, req.params.id, req.user?.id, req.user?.role, status, {
      rejectionReason,
      paymentMethod,
      paymentReference,
    });
    await recordAudit({
      userId: req.user?.id,
      action: statusToAction[status] ?? AuditActions.EXPENSE_UPDATED,
      entity: "Expense",
      entityId: expense.id,
      metadata: { status, rejectionReason, paymentReference },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("expense:updated", expense);
    res.status(200).json(new ApiResponse(`Expense ${expense.status.toLowerCase()}`, expense));
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const result = await expensesService.deleteExpense(hotelId, req.params.id);
    await recordAudit({ userId: req.user?.id, action: AuditActions.EXPENSE_DELETED, entity: "Expense", entityId: result.id, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("expense:deleted", result);
    res.status(200).json(new ApiResponse("Expense deleted", result));
  }),

  listCategories: catchAsync(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === "true";
    const categories = await expensesService.listCategories(requireHotelId(req), includeInactive);
    res.status(200).json(new ApiResponse("Expense categories fetched", categories));
  }),

  createCategory: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const category = await expensesService.createCategory(hotelId, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.EXPENSE_CATEGORY_CREATED, entity: "ExpenseCategory", entityId: category.id, metadata: req.body, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("expense-category:created", category);
    res.status(201).json(new ApiResponse("Expense category created", category));
  }),

  updateCategory: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const category = await expensesService.updateCategory(hotelId, req.params.id, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.EXPENSE_CATEGORY_UPDATED, entity: "ExpenseCategory", entityId: category.id, metadata: req.body, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("expense-category:updated", category);
    res.status(200).json(new ApiResponse("Expense category updated", category));
  }),
};
