import { Request, Response } from "express";
import { authorize } from "../src/middlewares/rbac.middleware";
import { ApiError } from "../src/utils/ApiError";

function mockReq(user?: { id: string; role: string; hotelId: string | null }): Partial<Request> {
  return { user: user as any };
}

describe("authorize (RBAC middleware)", () => {
  it("calls next() with 401 when there is no authenticated user", () => {
    const req = mockReq(undefined);
    const next = jest.fn();
    authorize("SUPER_ADMIN")(req as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect((next.mock.calls[0][0] as ApiError).statusCode).toBe(401);
  });

  it("calls next() with 403 when the user's role isn't in the allow-list", () => {
    const req = mockReq({ id: "u1", role: "HOUSEKEEPING", hotelId: "h1" });
    const next = jest.fn();
    authorize("SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER")(req as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect((next.mock.calls[0][0] as ApiError).statusCode).toBe(403);
  });

  it("calls next() with no arguments when the user's role is allowed", () => {
    const req = mockReq({ id: "u1", role: "MANAGER", hotelId: "h1" });
    const next = jest.fn();
    authorize("SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER")(req as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
