import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Role-based access control. Usage: router.get('/x', authenticate, authorize('HOTEL_ADMIN', 'MANAGER'), handler)
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden("You do not have permission to perform this action"));
    }
    return next();
  };
}
