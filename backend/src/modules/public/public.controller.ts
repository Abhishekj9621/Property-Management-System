import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { publicService } from "./public.service";

export const publicController = {
  listListings: catchAsync(async (_req: Request, res: Response) => {
    const listings = await publicService.listPublishedListings();
    res.status(200).json(new ApiResponse("Listings fetched", listings, { count: listings.length }));
  }),

  submitContact: catchAsync(async (req: Request, res: Response) => {
    await publicService.submitContactForm(req.body);
    res.status(200).json(new ApiResponse("Thank you for reaching out! We will get back to you within 24 hours.", null));
  }),
};
