import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import { ApiResponse } from "../../../utils/ApiResponse";
import { requireHotelId } from "../../../utils/requestHotel";
import { creditNotesService } from "./credit-notes.service";
import { recordAudit, AuditActions } from "../../../lib/auditLog";

export const creditNotesController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const creditNote = await creditNotesService.issueCreditNote(hotelId, req.user?.id, req.body);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.FINANCE_CREDIT_NOTE_ISSUED,
      entity: "CreditNote",
      entityId: creditNote.id,
      metadata: { creditNoteNumber: creditNote.creditNoteNumber, amount: creditNote.amount },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("creditnote:issued", creditNote);
    res.status(201).json(new ApiResponse("Credit note issued", creditNote));
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const { invoiceId, status, page, limit } = req.query as Record<string, string>;
    const result = await creditNotesService.listCreditNotes(hotelId, {
      invoiceId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(new ApiResponse("Credit notes fetched", result.items, { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages }));
  }),

  get: catchAsync(async (req: Request, res: Response) => {
    const creditNote = await creditNotesService.getCreditNote(requireHotelId(req), req.params.id);
    res.status(200).json(new ApiResponse("Credit note fetched", creditNote));
  }),

  void: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const creditNote = await creditNotesService.voidCreditNote(hotelId, req.params.id, req.user?.id);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.FINANCE_CREDIT_NOTE_VOIDED,
      entity: "CreditNote",
      entityId: creditNote.id,
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("creditnote:voided", creditNote);
    res.status(200).json(new ApiResponse("Credit note voided", creditNote));
  }),
};
