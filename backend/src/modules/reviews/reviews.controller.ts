import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { reviewsService } from "./reviews.service";
import { requireHotelId } from "../../utils/requestHotel";
import { recordAudit, AuditActions } from "../../lib/auditLog";

export const reviewsController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const review = await reviewsService.create(hotelId, req.body);
    res.status(201).json(new ApiResponse("Review submitted", review));
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const { page, limit } = req.query;
    const result = await reviewsService.listForHotel(hotelId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(new ApiResponse("Reviews fetched", result));
  }),

  respond: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const review = await reviewsService.respond(hotelId, req.params.id, req.body.response);
    await recordAudit({ userId: req.user?.id, action: AuditActions.REVIEW_RESPONDED, entity: "Review", entityId: review.id, ipAddress: req.ip });
    res.status(200).json(new ApiResponse("Response saved", review));
  }),
};
