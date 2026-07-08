import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import { ApiResponse } from "../../../utils/ApiResponse";
import { requireHotelId } from "../../../utils/requestHotel";
import { refundsService } from "./refunds.service";
import { recordAudit, AuditActions } from "../../../lib/auditLog";

export const refundsController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const refund = await refundsService.requestRefund(hotelId, req.user?.id, req.body);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.FINANCE_REFUND_REQUESTED,
      entity: "Refund",
      entityId: refund.id,
      metadata: { amount: refund.amount, bookingId: refund.bookingId },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("refund:requested", refund);
    res.status(201).json(new ApiResponse("Refund requested", refund));
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const { status, bookingId, from, to, page, limit } = req.query as Record<string, string>;
    const result = await refundsService.listRefunds(hotelId, {
      status,
      bookingId,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(
      new ApiResponse("Refunds fetched", result.items, { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages, summary: result.summary })
    );
  }),

  get: catchAsync(async (req: Request, res: Response) => {
    const refund = await refundsService.getRefund(requireHotelId(req), req.params.id);
    res.status(200).json(new ApiResponse("Refund fetched", refund));
  }),

  decide: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const refund = await refundsService.decideRefund(hotelId, req.params.id, req.user?.id, req.body.status, req.body.rejectionReason);
    await recordAudit({
      userId: req.user?.id,
      action: req.body.status === "APPROVED" ? AuditActions.FINANCE_REFUND_APPROVED : AuditActions.FINANCE_REFUND_REJECTED,
      entity: "Refund",
      entityId: refund.id,
      metadata: { rejectionReason: req.body.rejectionReason },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit(req.body.status === "APPROVED" ? "refund:approved" : "refund:rejected", refund);
    res.status(200).json(new ApiResponse(`Refund ${req.body.status.toLowerCase()}`, refund));
  }),

  process: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const refund = await refundsService.processRefund(hotelId, req.params.id, req.user?.id, req.body.transactionRef);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.FINANCE_REFUND_PROCESSED,
      entity: "Refund",
      entityId: refund.id,
      metadata: { amount: refund.amount, transactionRef: req.body.transactionRef },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("refund:processed", refund);
    res.status(200).json(new ApiResponse("Refund processed", refund));
  }),
};
