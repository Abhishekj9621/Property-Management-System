import { Request } from "express";
import { requireHotelId } from "../src/utils/requestHotel";

function mockReq(overrides: Partial<Request> & { user?: any }): Request {
  return {
    headers: {},
    query: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

describe("requireHotelId", () => {
  it("returns a hotel-pinned user's own hotelId, ignoring the header entirely", () => {
    const req = mockReq({
      user: { id: "u1", role: "MANAGER", hotelId: "hotel-A" },
      headers: { "x-hotel-id": "hotel-B" },
    });
    expect(requireHotelId(req)).toBe("hotel-A");
  });

  it("ignores a spoofed hotelId in the query string for a hotel-pinned user", () => {
    const req = mockReq({
      user: { id: "u1", role: "RECEPTIONIST", hotelId: "hotel-A" },
      query: { hotelId: "hotel-B" },
    });
    expect(requireHotelId(req)).toBe("hotel-A");
  });

  it("ignores a spoofed hotelId in the request body for a hotel-pinned user", () => {
    const req = mockReq({
      user: { id: "u1", role: "HOTEL_ADMIN", hotelId: "hotel-A" },
      body: { hotelId: "hotel-B" },
    });
    expect(requireHotelId(req)).toBe("hotel-A");
  });

  it("uses the x-hotel-id header for a SUPER_ADMIN (no fixed hotel)", () => {
    const req = mockReq({
      user: { id: "u1", role: "SUPER_ADMIN", hotelId: null },
      headers: { "x-hotel-id": "hotel-B" },
    });
    expect(requireHotelId(req)).toBe("hotel-B");
  });

  it("falls back to the query param, then body, for a SUPER_ADMIN with no header", () => {
    const req1 = mockReq({ user: { id: "u1", role: "SUPER_ADMIN", hotelId: null }, query: { hotelId: "hotel-C" } });
    expect(requireHotelId(req1)).toBe("hotel-C");

    const req2 = mockReq({ user: { id: "u1", role: "SUPER_ADMIN", hotelId: null }, body: { hotelId: "hotel-D" } });
    expect(requireHotelId(req2)).toBe("hotel-D");
  });

  it("throws 400 when a SUPER_ADMIN provides no hotel at all", () => {
    const req = mockReq({ user: { id: "u1", role: "SUPER_ADMIN", hotelId: null } });
    expect(() => requireHotelId(req)).toThrow(/hotelId is required/);
  });

  it("handles an array-valued x-hotel-id header by taking the first entry", () => {
    const req = mockReq({
      user: { id: "u1", role: "SUPER_ADMIN", hotelId: null },
      headers: { "x-hotel-id": ["hotel-E", "hotel-F"] as any },
    });
    expect(requireHotelId(req)).toBe("hotel-E");
  });
});
