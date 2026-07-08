import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import { ApiResponse } from "../../../utils/ApiResponse";
import { requireHotelId } from "../../../utils/requestHotel";
import { financialReportsService } from "./financial-reports.service";

export const financialReportsController = {
  profitAndLoss: catchAsync(async (req: Request, res: Response) => {
    const { from, to } = req.query as Record<string, string>;
    const pnl = await financialReportsService.profitAndLoss(requireHotelId(req), from, to);
    res.status(200).json(new ApiResponse("Profit & loss computed", pnl));
  }),

  profitAndLossCsv: catchAsync(async (req: Request, res: Response) => {
    const { from, to } = req.query as Record<string, string>;
    const pnl = await financialReportsService.profitAndLoss(requireHotelId(req), from, to);
    const csv = financialReportsService.profitAndLossCsv(pnl);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="profit-and-loss-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send(csv);
  }),

  arAging: catchAsync(async (req: Request, res: Response) => {
    const result = await financialReportsService.arAging(requireHotelId(req));
    res.status(200).json(new ApiResponse("AR aging computed", result));
  }),

  arAgingCsv: catchAsync(async (req: Request, res: Response) => {
    const result = await financialReportsService.arAging(requireHotelId(req));
    const csv = financialReportsService.arAgingCsv(result.rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="ar-aging-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send(csv);
  }),

  dailyCash: catchAsync(async (req: Request, res: Response) => {
    const result = await financialReportsService.dailyCash(requireHotelId(req), req.query.date as string);
    res.status(200).json(new ApiResponse("Daily cash report computed", result));
  }),

  consolidated: catchAsync(async (req: Request, res: Response) => {
    const { from, to } = req.query as Record<string, string>;
    const result = await financialReportsService.consolidated(from, to);
    res.status(200).json(new ApiResponse("Consolidated financial report computed", result));
  }),
};
