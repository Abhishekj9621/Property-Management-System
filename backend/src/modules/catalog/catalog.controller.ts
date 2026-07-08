import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { hotelTypesService, roomCategoriesService } from "./catalog.service";

const includeInactive = (req: Request) => req.query.includeInactive === "true" && req.user?.role === "SUPER_ADMIN";

export const hotelTypesController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const items = await hotelTypesService.list(includeInactive(req));
    res.status(200).json(new ApiResponse("Hotel types fetched", items));
  }),
  create: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const item = await hotelTypesService.create(req.user, req.body);
    res.status(201).json(new ApiResponse("Hotel type created", item));
  }),
  update: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const item = await hotelTypesService.update(req.user, req.params.id, req.body);
    res.status(200).json(new ApiResponse("Hotel type updated", item));
  }),
  remove: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const item = await hotelTypesService.remove(req.user, req.params.id);
    res.status(200).json(new ApiResponse("Hotel type removed", item));
  }),
};

export const roomCategoriesController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const items = await roomCategoriesService.list(includeInactive(req));
    res.status(200).json(new ApiResponse("Room categories fetched", items));
  }),
  create: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const item = await roomCategoriesService.create(req.user, req.body);
    res.status(201).json(new ApiResponse("Room category created", item));
  }),
  update: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const item = await roomCategoriesService.update(req.user, req.params.id, req.body);
    res.status(200).json(new ApiResponse("Room category updated", item));
  }),
  remove: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const item = await roomCategoriesService.remove(req.user, req.params.id);
    res.status(200).json(new ApiResponse("Room category removed", item));
  }),
};
