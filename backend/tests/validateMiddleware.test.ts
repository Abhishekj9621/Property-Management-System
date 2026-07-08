import { z } from "zod";
import { Request, Response } from "express";
import { validate } from "../src/middlewares/validate.middleware";

function mockRes(): Response {
  return {} as Response;
}

describe("validate middleware — field-level error reporting", () => {
  const schema = z.object({
    body: z
      .object({
        guestId: z.string().uuid().optional(),
        bookingId: z.string().uuid().optional(),
        amount: z.number().positive(),
      })
      .refine((data) => data.bookingId || data.guestId, { message: "Either bookingId or guestId is required", path: ["bookingId"] }),
  });

  it("names the actual field that failed, not just 'Validation failed'", () => {
    const req = { body: { guestId: "New", amount: 100 }, query: {}, params: {} } as unknown as Request;
    const next = jest.fn();

    validate(schema)(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    // The old behavior only ever said "Validation failed" here, with the
    // real reason buried in a `details` shape the frontend never read.
    expect(err.message).toContain("guestId");
    expect(err.message.toLowerCase()).toContain("uuid");
    expect(err.details.fieldErrors).toEqual(expect.arrayContaining([expect.objectContaining({ field: "guestId" })]));
  });

  it("strips the body/query/params prefix from the reported field name", () => {
    const req = { body: { amount: -5 }, query: {}, params: {} } as unknown as Request;
    const next = jest.fn();

    validate(schema)(req, mockRes(), next);

    const err = next.mock.calls[0][0];
    const fields = err.details.fieldErrors.map((f: any) => f.field);
    expect(fields).toContain("amount");
    expect(fields).not.toContain("body");
    expect(fields).not.toContain("body.amount");
  });

  it("reports a top-level refine error (no specific field) using its declared path", () => {
    const req = { body: { amount: 100 }, query: {}, params: {} } as unknown as Request; // no guestId or bookingId
    const next = jest.fn();

    validate(schema)(req, mockRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.message).toContain("Either bookingId or guestId is required");
  });

  it("calls next() with no error when validation passes", () => {
    const req = { body: { guestId: "11111111-1111-1111-1111-111111111111", amount: 100 }, query: {}, params: {} } as unknown as Request;
    const next = jest.fn();

    validate(schema)(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
  });
});
