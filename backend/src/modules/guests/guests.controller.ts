import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { guestsService } from "./guests.service";
import { requireHotelId } from "../../utils/requestHotel";
import { recordAudit, AuditActions } from "../../lib/auditLog";

export const guestsController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const guest = await guestsService.create(hotelId, req.body);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.GUEST_CREATED,
      entity: "Guest",
      entityId: guest.id,
      metadata: { email: guest.email },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("guest:created", guest);
    res.status(201).json(new ApiResponse("Guest created", guest));
  }),
  list: catchAsync(async (req: Request, res: Response) => {
    const guests = await guestsService.list(requireHotelId(req), req.query.search as string);
    res.status(200).json(new ApiResponse("Guests fetched", guests));
  }),
  get: catchAsync(async (req: Request, res: Response) => {
    const guest = await guestsService.get(requireHotelId(req), req.params.id);
    res.status(200).json(new ApiResponse("Guest fetched", guest));
  }),
  update: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const guest = await guestsService.update(hotelId, req.params.id, req.body);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.GUEST_UPDATED,
      entity: "Guest",
      entityId: guest.id,
      metadata: { changes: req.body },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("guest:updated", guest);
    res.status(200).json(new ApiResponse("Guest updated", guest));
  }),
  remove: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const result = await guestsService.delete(hotelId, req.params.id);
    await recordAudit({ userId: req.user?.id, action: AuditActions.GUEST_DELETED, entity: "Guest", entityId: result.id, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("guest:deleted", result);
    res.status(200).json(new ApiResponse("Guest deleted", result));
  }),
};
