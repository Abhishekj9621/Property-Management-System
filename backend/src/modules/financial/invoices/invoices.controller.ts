import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import { ApiResponse } from "../../../utils/ApiResponse";
import { requireHotelId } from "../../../utils/requestHotel";
import { invoicesService } from "./invoices.service";
import { recordAudit, AuditActions } from "../../../lib/auditLog";

export const invoicesController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const invoice = await invoicesService.createInvoice(hotelId, req.user?.id, req.body);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.FINANCE_INVOICE_CREATED,
      entity: "Invoice",
      entityId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, total: invoice.total, status: invoice.status },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("invoice:created", invoice);
    res.status(201).json(new ApiResponse("Invoice created", invoice));
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const { status, type, guestId, bookingId, from, to, page, limit } = req.query as Record<string, string>;
    const result = await invoicesService.listInvoices(hotelId, {
      status,
      type,
      guestId,
      bookingId,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(
      new ApiResponse("Invoices fetched", result.items, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        summary: result.summary,
      })
    );
  }),

  get: catchAsync(async (req: Request, res: Response) => {
    const invoice = await invoicesService.getInvoice(requireHotelId(req), req.params.id);
    res.status(200).json(new ApiResponse("Invoice fetched", invoice));
  }),

  updateDraft: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const invoice = await invoicesService.updateDraft(hotelId, req.params.id, req.body);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.FINANCE_INVOICE_UPDATED,
      entity: "Invoice",
      entityId: invoice.id,
      ipAddress: req.ip,
    });
    res.status(200).json(new ApiResponse("Invoice updated", invoice));
  }),

  issue: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const invoice = await invoicesService.issueInvoice(hotelId, req.params.id, req.user?.id);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.FINANCE_INVOICE_ISSUED,
      entity: "Invoice",
      entityId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("invoice:issued", invoice);
    res.status(200).json(new ApiResponse("Invoice issued", invoice));
  }),

  void: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const invoice = await invoicesService.voidInvoice(hotelId, req.params.id, req.user?.id, req.body.reason);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.FINANCE_INVOICE_VOIDED,
      entity: "Invoice",
      entityId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, reason: req.body.reason },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("invoice:voided", invoice);
    res.status(200).json(new ApiResponse("Invoice voided", invoice));
  }),

  markAdhocPaid: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const invoice = await invoicesService.markAdhocInvoicePaid(hotelId, req.params.id);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.FINANCE_INVOICE_PAID,
      entity: "Invoice",
      entityId: invoice.id,
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("invoice:paid", invoice);
    res.status(200).json(new ApiResponse("Invoice marked as paid", invoice));
  }),
};
