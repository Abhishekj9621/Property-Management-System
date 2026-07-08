import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { auditLogsService } from "./audit-logs.service";

export const auditLogsController = {
  list: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { action, entity, userId, from, to, page, pageSize } = req.query;
    const result = await auditLogsService.list(req.user, {
      action: action as string | undefined,
      entity: entity as string | undefined,
      userId: userId as string | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    res.status(200).json(new ApiResponse("Audit logs fetched", result));
  }),
};
