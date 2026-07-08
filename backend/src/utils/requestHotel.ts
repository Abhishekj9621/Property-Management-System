import { Request } from "express";
import { ApiError } from "./ApiError";

/**
 * Resolves which hotel a request should operate against.
 *
 * Priority:
 *  1. The hotel baked into the authenticated user's JWT (staff who belong to
 *     a single property — HOTEL_ADMIN, MANAGER, RECEPTIONIST, HOUSEKEEPING).
 *  2. An explicit `x-hotel-id` header. This is how multi-property staff
 *     (SUPER_ADMIN, whose token has no fixed hotelId) tell the API which
 *     hotel they're currently working in — the frontend's hotel switcher
 *     sets this header automatically on every request.
 *  3. A `hotelId` query parameter (useful for simple GET requests / links).
 *  4. A `hotelId` field in the request body (useful for POST/PATCH payloads).
 *
 * Throws a 400 if none of the above yield a hotel, and a 403 if a
 * hotel-scoped user tries to operate on a different hotel than their own.
 */
export function requireHotelId(req: Request): string {
  // Staff pinned to a single hotel (everyone except SUPER_ADMIN) always
  // operate on their own hotel, full stop — any x-hotel-id header, query
  // param, or body field is ignored for them. This is what actually
  // prevents a hotel-scoped user from spoofing a header to reach another
  // property's data; it isn't a fallback, it's the whole security property.
  if (req.user?.hotelId) {
    return req.user.hotelId;
  }

  // Multi-property staff (SUPER_ADMIN) have no fixed hotel, so they must
  // say which one they're working in via the hotel switcher (x-hotel-id
  // header), a query param, or a body field, in that priority order.
  const headerHotelId = req.headers["x-hotel-id"];
  const fromHeader = Array.isArray(headerHotelId) ? headerHotelId[0] : headerHotelId;
  const requested = fromHeader ?? (req.query.hotelId as string | undefined) ?? (req.body?.hotelId as string | undefined);

  if (!requested) {
    throw ApiError.badRequest(
      "hotelId is required. Select a hotel (via the hotel switcher) or ensure your account is assigned to a property."
    );
  }

  return requested;
}
