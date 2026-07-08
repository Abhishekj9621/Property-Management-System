import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { usersService } from "./users.service";
import { ApiError } from "../../utils/ApiError";

export const usersController = {
  create: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const user = await usersService.create(req.user, req.body);
    if (user.hotelId) req.app.get("io")?.to(`hotel:${user.hotelId}`).emit("staff:created", user);
    res.status(201).json(new ApiResponse("Staff account created", user));
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { hotelId, role, includeInactive, search } = req.query;
    const users = await usersService.list(req.user, {
      hotelId: hotelId as string | undefined,
      role: role as any,
      includeInactive: includeInactive === "true",
      search: search as string | undefined,
    });
    res.status(200).json(new ApiResponse("Staff fetched", users));
  }),

  get: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const user = await usersService.get(req.user, req.params.id);
    res.status(200).json(new ApiResponse("Staff fetched", user));
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const user = await usersService.update(req.user, req.params.id, req.body);
    if (user.hotelId) req.app.get("io")?.to(`hotel:${user.hotelId}`).emit("staff:updated", user);
    res.status(200).json(new ApiResponse("Staff updated", user));
  }),

  resetPassword: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await usersService.resetPassword(req.user, req.params.id, req.body.newPassword);
    res.status(200).json(new ApiResponse("Password reset", result));
  }),

  deactivate: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await usersService.deactivate(req.user, req.params.id);
    req.app.get("io")?.emit("staff:deactivated", result);
    res.status(200).json(new ApiResponse("Staff account deactivated", result));
  }),

  restore: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await usersService.restore(req.user, req.params.id);
    req.app.get("io")?.emit("staff:restored", result);
    res.status(200).json(new ApiResponse("Staff account restored", result));
  }),
};
