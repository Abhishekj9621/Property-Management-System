import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { dashboardService } from "./dashboard.service";
import { requireHotelId } from "../../utils/requestHotel";

export const dashboardController = {
  overview: catchAsync(async (req: Request, res: Response) => {
    const data = await dashboardService.getOverview(requireHotelId(req));
    res.status(200).json(new ApiResponse("Dashboard overview fetched", data));
  }),
  upcoming: catchAsync(async (req: Request, res: Response) => {
    const data = await dashboardService.getUpcoming(requireHotelId(req));
    res.status(200).json(new ApiResponse("Upcoming arrivals/departures fetched", data));
  }),
};
