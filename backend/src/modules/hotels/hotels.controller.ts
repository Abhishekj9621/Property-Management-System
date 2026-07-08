import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { hotelsService } from "./hotels.service";
import { ApiError } from "../../utils/ApiError";

export const hotelsController = {
  create: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const hotel = await hotelsService.create(req.user, req.body);
    res.status(201).json(new ApiResponse("Hotel created", hotel));
  }),
  list: catchAsync(async (req: Request, res: Response) => {
    const { status, search } = req.query;
    const hotels = await hotelsService.list(req.user, {
      status: status as "active" | "inactive" | "all" | undefined,
      search: search as string | undefined,
    });
    res.status(200).json(new ApiResponse("Hotels fetched", hotels));
  }),
  get: catchAsync(async (req: Request, res: Response) => {
    const hotel = await hotelsService.get(req.params.id);
    res.status(200).json(new ApiResponse("Hotel fetched", hotel));
  }),
  update: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const hotel = await hotelsService.update(req.user, req.params.id, req.body);
    res.status(200).json(new ApiResponse("Hotel updated", hotel));
  }),
  remove: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const hotel = await hotelsService.remove(req.user, req.params.id);
    res.status(200).json(new ApiResponse("Hotel deactivated", hotel));
  }),
  restore: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const hotel = await hotelsService.restore(req.user, req.params.id);
    res.status(200).json(new ApiResponse("Hotel restored", hotel));
  }),
  permanentlyDelete: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await hotelsService.permanentlyDelete(req.user, req.params.id);
    res.status(200).json(new ApiResponse("Hotel permanently deleted", result));
  }),
  getWebsiteListing: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const listing = await hotelsService.getWebsiteListing(req.user, req.params.id);
    res.status(200).json(new ApiResponse("Website listing fetched", listing));
  }),
  upsertWebsiteListing: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const listing = await hotelsService.upsertWebsiteListing(req.user, req.params.id, req.body);
    res.status(200).json(new ApiResponse("Website listing saved", listing));
  }),
};
