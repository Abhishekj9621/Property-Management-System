import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps async controller/middleware functions so rejected promises
 * are forwarded to Express's centralized error handler instead of
 * crashing the process or requiring try/catch boilerplate everywhere.
 */
export function catchAsync(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
