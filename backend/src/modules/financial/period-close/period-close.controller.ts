import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import { ApiResponse } from "../../../utils/ApiResponse";
import { requireHotelId } from "../../../utils/requestHotel";
import { periodCloseService } from "./period-close.service";
import { recordAudit, AuditActions } from "../../../lib/auditLog";

export const periodCloseController = {
  preview: catchAsync(async (req: Request, res: Response) => {
    const snapshot = await periodCloseService.preview(requireHotelId(req), req.query.businessDate as string);
    res.status(200).json(new ApiResponse("Day-end preview computed", snapshot));
  }),

  close: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const close = await periodCloseService.closeDay(hotelId, req.user?.id, req.body.businessDate, req.body.notes);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.FINANCE_PERIOD_CLOSED,
      entity: "FinancialPeriodClose",
      entityId: close.id,
      metadata: { businessDate: req.body.businessDate, netCashPosition: close.netCashPosition },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("period:closed", close);
    res.status(201).json(new ApiResponse("Business day closed", close));
  }),

  reopen: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const close = await periodCloseService.reopenDay(hotelId, req.params.id, req.user?.id, req.body.reason);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.FINANCE_PERIOD_REOPENED,
      entity: "FinancialPeriodClose",
      entityId: close.id,
      metadata: { reason: req.body.reason },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("period:reopened", close);
    res.status(200).json(new ApiResponse("Business day reopened", close));
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const { from, to, page, limit } = req.query as Record<string, string>;
    const result = await periodCloseService.listCloses(hotelId, { from, to, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
    res.status(200).json(new ApiResponse("Financial period closes fetched", result.items, { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages }));
  }),
};
