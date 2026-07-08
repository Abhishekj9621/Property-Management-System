import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import { ApiResponse } from "../../../utils/ApiResponse";
import { requireHotelId } from "../../../utils/requestHotel";
import { expenseReportsService } from "./expense-reports.service";

export const expenseReportsController = {
  summary: catchAsync(async (req: Request, res: Response) => {
    const { from, to } = req.query as Record<string, string>;
    const result = await expenseReportsService.summary(requireHotelId(req), from, to);
    res.status(200).json(new ApiResponse("Expense summary computed", result));
  }),

  byCategory: catchAsync(async (req: Request, res: Response) => {
    const { from, to } = req.query as Record<string, string>;
    const result = await expenseReportsService.byCategory(requireHotelId(req), from, to);
    res.status(200).json(new ApiResponse("Spend by category computed", result));
  }),

  byCategoryCsv: catchAsync(async (req: Request, res: Response) => {
    const { from, to } = req.query as Record<string, string>;
    const rows = await expenseReportsService.byCategory(requireHotelId(req), from, to);
    const csv = expenseReportsService.byCategoryCsv(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="expenses-by-category-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send(csv);
  }),

  byVendor: catchAsync(async (req: Request, res: Response) => {
    const { from, to } = req.query as Record<string, string>;
    const result = await expenseReportsService.byVendor(requireHotelId(req), from, to);
    res.status(200).json(new ApiResponse("Spend by vendor computed", result));
  }),

  byVendorCsv: catchAsync(async (req: Request, res: Response) => {
    const { from, to } = req.query as Record<string, string>;
    const rows = await expenseReportsService.byVendor(requireHotelId(req), from, to);
    const csv = expenseReportsService.byVendorCsv(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="expenses-by-vendor-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send(csv);
  }),

  monthlyTrend: catchAsync(async (req: Request, res: Response) => {
    const months = req.query.months ? Number(req.query.months) : 6;
    const result = await expenseReportsService.monthlyTrend(requireHotelId(req), months);
    res.status(200).json(new ApiResponse("Monthly trend computed", result));
  }),
};
