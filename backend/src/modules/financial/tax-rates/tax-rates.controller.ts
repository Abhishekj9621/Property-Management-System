import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import { ApiResponse } from "../../../utils/ApiResponse";
import { requireHotelId } from "../../../utils/requestHotel";
import { taxRatesService } from "./tax-rates.service";
import { recordAudit, AuditActions } from "../../../lib/auditLog";

export const taxRatesController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === "true";
    const rates = await taxRatesService.listForHotel(requireHotelId(req), includeInactive);
    res.status(200).json(new ApiResponse("Tax rates fetched", rates));
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const rate = await taxRatesService.createTaxRate(hotelId, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.FINANCE_TAX_RATE_CREATED, entity: "TaxRate", entityId: rate.id, metadata: req.body, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("taxrate:created", rate);
    res.status(201).json(new ApiResponse("Tax rate created", rate));
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const rate = await taxRatesService.updateTaxRate(hotelId, req.params.id, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.FINANCE_TAX_RATE_UPDATED, entity: "TaxRate", entityId: rate.id, metadata: req.body, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("taxrate:updated", rate);
    res.status(200).json(new ApiResponse("Tax rate updated", rate));
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const result = await taxRatesService.deleteTaxRate(hotelId, req.params.id);
    await recordAudit({ userId: req.user?.id, action: AuditActions.FINANCE_TAX_RATE_DEACTIVATED, entity: "TaxRate", entityId: result.id, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("taxrate:deactivated", result);
    res.status(200).json(new ApiResponse("Tax rate deactivated", result));
  }),
};
