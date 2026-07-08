import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import { ApiResponse } from "../../../utils/ApiResponse";
import { requireHotelId } from "../../../utils/requestHotel";
import { ledgerService } from "./ledger.service";
import { recordAudit, AuditActions } from "../../../lib/auditLog";

export const ledgerController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const { type, direction, sourceType, from, to, page, limit } = req.query as Record<string, string>;
    const result = await ledgerService.listEntries(hotelId, {
      type,
      direction,
      sourceType,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(
      new ApiResponse("Ledger entries fetched", result.items, { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages, summary: result.summary })
    );
  }),

  createManualEntry: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const entry = await ledgerService.createManualEntry(hotelId, req.user?.id, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.FINANCE_LEDGER_MANUAL_ENTRY, entity: "LedgerEntry", entityId: entry.id, metadata: req.body, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("ledger:entry-created", entry);
    res.status(201).json(new ApiResponse("Ledger entry recorded", entry));
  }),
};
