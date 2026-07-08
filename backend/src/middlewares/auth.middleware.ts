import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/jwt";
import { redis } from "../config/redis";

export interface AuthenticatedUser {
  id: string;
  role: string;
  hotelId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Verifies the Bearer access token and attaches the decoded identity
 * to req.user. Does not hit the database on every request (stateless),
 * which keeps auth cheap; revocation is handled via short-lived access
 * tokens + a Redis-backed refresh-token blacklist, plus an explicit
 * deactivation flag (see users.service.ts#deactivate) so disabling an
 * account takes effect immediately instead of waiting out the access
 * token's remaining TTL.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing or invalid Authorization header"));
  }

  const token = header.split(" ")[1];
  try {
    const payload = verifyAccessToken(token);

    // Honor logout: tokens are blacklisted in Redis for their remaining
    // TTL when a user logs out, so a stolen/cached bearer token can't be
    // replayed after the user has explicitly ended their session.
    const [isBlacklisted, isDeactivated] = await Promise.all([redis.get(`bl:${token}`), redis.get(`deactivated:${payload.sub}`)]);
    if (isBlacklisted) {
      return next(ApiError.unauthorized("Session has been logged out"));
    }
    if (isDeactivated) {
      return next(ApiError.unauthorized("This account has been deactivated"));
    }

    req.user = { id: payload.sub, role: payload.role, hotelId: payload.hotelId };
    return next();
  } catch (err) {
    return next(ApiError.unauthorized("Invalid or expired access token"));
  }
}
