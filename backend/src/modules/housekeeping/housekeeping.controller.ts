import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { housekeepingService } from "./housekeeping.service";
import { requireHotelId } from "../../utils/requestHotel";
import { recordAudit, AuditActions } from "../../lib/auditLog";

export const housekeepingController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const task = await housekeepingService.createTask(hotelId, req.body);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.HOUSEKEEPING_TASK_CREATED,
      entity: "HousekeepingTask",
      entityId: task.id,
      metadata: { roomId: task.roomId, type: task.type },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("housekeeping:task-created", task);
    res.status(201).json(new ApiResponse("Task created", task));
  }),
  list: catchAsync(async (req: Request, res: Response) => {
    const tasks = await housekeepingService.listTasks(requireHotelId(req), {
      status: req.query.status as string,
      assigneeId: req.query.assigneeId as string,
    });
    res.status(200).json(new ApiResponse("Tasks fetched", tasks));
  }),
  update: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const task = await housekeepingService.updateTask(hotelId, req.params.id, req.body);
    await recordAudit({
      userId: req.user?.id,
      action: AuditActions.HOUSEKEEPING_TASK_UPDATED,
      entity: "HousekeepingTask",
      entityId: task.id,
      metadata: { status: task.status },
      ipAddress: req.ip,
    });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("housekeeping:task-updated", task);
    // A verified/completed task also flips the room's status — mirror that
    // to the live room board too, since it's rendered on a different page.
    if (req.body.status === "VERIFIED" || req.body.status === "COMPLETED") {
      req.app.get("io")?.to(`hotel:${hotelId}`).emit("room:status-changed", task.room);
    }
    res.status(200).json(new ApiResponse("Task updated", task));
  }),
  remove: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const result = await housekeepingService.deleteTask(hotelId, req.params.id);
    await recordAudit({ userId: req.user?.id, action: AuditActions.HOUSEKEEPING_TASK_DELETED, entity: "HousekeepingTask", entityId: result.id, ipAddress: req.ip });
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("housekeeping:task-deleted", result);
    res.status(200).json(new ApiResponse("Task deleted", result));
  }),
};
