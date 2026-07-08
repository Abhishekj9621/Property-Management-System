import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { notificationsService } from "./notifications.service";

export const notificationsController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const { unreadOnly, page, limit } = req.query;
    const result = await notificationsService.listForUser(req.user!.id, {
      unreadOnly: unreadOnly === "true",
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(new ApiResponse("Notifications fetched", result));
  }),

  markRead: catchAsync(async (req: Request, res: Response) => {
    const result = await notificationsService.markRead(req.user!.id, req.params.id);
    res.status(200).json(new ApiResponse("Notification marked as read", result));
  }),

  markAllRead: catchAsync(async (req: Request, res: Response) => {
    const result = await notificationsService.markAllRead(req.user!.id);
    res.status(200).json(new ApiResponse("All notifications marked as read", result));
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    const result = await notificationsService.remove(req.user!.id, req.params.id);
    res.status(200).json(new ApiResponse("Notification deleted", result));
  }),
};
