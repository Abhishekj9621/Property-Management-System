import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import { ApiResponse } from "../../../utils/ApiResponse";
import { requireHotelId } from "../../../utils/requestHotel";
import { vendorsService } from "./vendors.service";
import { recordAudit, AuditActions } from "../../../lib/auditLog";

export const vendorsController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === "true";
    const vendors = await vendorsService.list(requireHotelId(req), includeInactive);
    res.status(200).json(new ApiResponse("Vendors fetched", vendors));
  }),

  get: catchAsync(async (req: Request, res: Response) => {
    const vendor = await vendorsService.get(requireHotelId(req), req.params.id);
    res.status(200).json(new ApiResponse("Vendor fetched", vendor));
  }),

  spendSummary: catchAsync(async (req: Request, res: Response) => {
    const summary = await vendorsService.spendSummary(requireHotelId(req), req.params.id);
    res.status(200).json(new ApiResponse("Vendor spend summary fetched", summary));
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const vendor = await vendorsService.create(hotelId, req.user?.id, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.VENDOR_CREATED, entity: "Vendor", entityId: vendor.id, metadata: { name: vendor.name }, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("vendor:created", vendor);
    res.status(201).json(new ApiResponse("Vendor created", vendor));
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const vendor = await vendorsService.update(hotelId, req.params.id, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.VENDOR_UPDATED, entity: "Vendor", entityId: vendor.id, metadata: req.body, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("vendor:updated", vendor);
    res.status(200).json(new ApiResponse("Vendor updated", vendor));
  }),

  deactivate: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const result = await vendorsService.deactivate(hotelId, req.params.id);
    await recordAudit({ userId: req.user?.id, action: AuditActions.VENDOR_DEACTIVATED, entity: "Vendor", entityId: result.id, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("vendor:deactivated", result);
    res.status(200).json(new ApiResponse("Vendor deactivated", result));
  }),
};
