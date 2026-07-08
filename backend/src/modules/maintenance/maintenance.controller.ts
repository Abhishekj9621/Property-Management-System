import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { maintenanceService } from "./maintenance.service";
import { requireHotelId } from "../../utils/requestHotel";
import { recordAudit, AuditActions } from "../../lib/auditLog";

export const maintenanceController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const request = await maintenanceService.createRequest(hotelId, req.user?.id, req.body);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.MAINTENANCE_REQUEST_CREATED,
      entity: "MaintenanceRequest",
      entityId: request.id,
      metadata: { title: request.title, priority: request.priority },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("maintenance:request-created", request);
    res.status(201).json(new ApiResponse("Maintenance request created", request));
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const { status, priority, assigneeId, assetId, page, limit } = req.query;
    const result = await maintenanceService.listRequests(requireHotelId(req), {
      status: status as string,
      priority: priority as string,
      assigneeId: assigneeId as string,
      assetId: assetId as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(new ApiResponse("Maintenance requests fetched", result.items, {
      total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages,
    }));
  }),

  get: catchAsync(async (req: Request, res: Response) => {
    const request = await maintenanceService.getRequest(requireHotelId(req), req.params.id);
    res.status(200).json(new ApiResponse("Maintenance request fetched", request));
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const request = await maintenanceService.updateRequest(hotelId, req.params.id, req.body);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.MAINTENANCE_REQUEST_UPDATED,
      entity: "MaintenanceRequest",
      entityId: request.id,
      metadata: { status: request.status },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("maintenance:request-updated", request);
    res.status(200).json(new ApiResponse("Maintenance request updated", request));
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const result = await maintenanceService.deleteRequest(hotelId, req.params.id);
    await recordAudit({ userId: req.user?.id, action: AuditActions.MAINTENANCE_REQUEST_DELETED, entity: "MaintenanceRequest", entityId: result.id, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("maintenance:request-deleted", result);
    res.status(200).json(new ApiResponse("Maintenance request deleted", result));
  }),

  // Assets
  createAsset: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const asset = await maintenanceService.createAsset(hotelId, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.ASSET_CREATED, entity: "Asset", entityId: asset.id, metadata: { name: asset.name }, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("asset:created", asset);
    res.status(201).json(new ApiResponse("Asset created", asset));
  }),

  listAssets: catchAsync(async (req: Request, res: Response) => {
    const assets = await maintenanceService.listAssets(requireHotelId(req), {
      status: req.query.status as string,
      category: req.query.category as string,
    });
    res.status(200).json(new ApiResponse("Assets fetched", assets));
  }),

  getAsset: catchAsync(async (req: Request, res: Response) => {
    const asset = await maintenanceService.getAsset(requireHotelId(req), req.params.id);
    res.status(200).json(new ApiResponse("Asset fetched", asset));
  }),

  updateAsset: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const asset = await maintenanceService.updateAsset(hotelId, req.params.id, req.body);
    await recordAudit({ userId: req.user?.id, action: AuditActions.ASSET_UPDATED, entity: "Asset", entityId: asset.id, metadata: req.body, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("asset:updated", asset);
    res.status(200).json(new ApiResponse("Asset updated", asset));
  }),

  removeAsset: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const result = await maintenanceService.deleteAsset(hotelId, req.params.id);
    await recordAudit({ userId: req.user?.id, action: AuditActions.ASSET_DELETED, entity: "Asset", entityId: result.id, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("asset:deleted", result);
    res.status(200).json(new ApiResponse("Asset deleted", result));
  }),
};
