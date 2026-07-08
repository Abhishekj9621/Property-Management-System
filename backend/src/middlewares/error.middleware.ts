import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";
import { env } from "../config/env";
import { Prisma } from "@prisma/client";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let apiError: ApiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    apiError = mapPrismaError(err);
  } else if (err instanceof Error) {
    apiError = new ApiError(500, env.isProd ? "Internal server error" : err.message, undefined, false);
  } else {
    apiError = ApiError.internal();
  }

  if (!apiError.isOperational) {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
  } else {
    logger.warn(`${apiError.statusCode} ${req.method} ${req.originalUrl}: ${apiError.message}`);
  }

  res.status(apiError.statusCode).json({
    success: false,
    message: apiError.message,
    details: apiError.details,
    ...(env.isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
}

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): ApiError {
  switch (err.code) {
    case "P2002":
      return ApiError.conflict(`A record with this ${(err.meta?.target as string[])?.join(", ")} already exists`);
    case "P2025":
      return ApiError.notFound("Record not found");
    case "P2003":
      return ApiError.badRequest("Invalid reference to a related record");
    default:
      return new ApiError(500, "Database error", undefined, false);
  }
}
