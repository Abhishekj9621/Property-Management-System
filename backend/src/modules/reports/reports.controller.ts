import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { reportsService } from "./reports.service";
import { requireHotelId } from "../../utils/requestHotel";

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}

export const reportsController = {
  bookingsCsv: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const csv = await reportsService.bookingsCsv(hotelId, req.query as any);
    sendCsv(res, `bookings-${Date.now()}.csv`, csv);
  }),

  revenueCsv: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const csv = await reportsService.revenueCsv(hotelId, req.query as any);
    sendCsv(res, `revenue-${Date.now()}.csv`, csv);
  }),

  occupancyCsv: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const csv = await reportsService.occupancyCsv(hotelId, req.query as any);
    sendCsv(res, `occupancy-${Date.now()}.csv`, csv);
  }),
};
