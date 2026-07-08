jest.mock("../src/config/database", () => {
  const prisma: any = {
    booking: { findFirst: jest.fn(), findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    payment: { findFirst: jest.fn(), update: jest.fn() },
    invoice: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    refund: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    ledgerEntry: { create: jest.fn().mockResolvedValue({}) },
    financialPeriodClose: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return { prisma };
});

import { prisma } from "../src/config/database";
import { refundsService } from "../src/modules/financial/refunds/refunds.service";

const mockedPrisma = prisma as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockedPrisma.financialPeriodClose.findFirst.mockResolvedValue(null);
});

describe("refundsService.requestRefund", () => {
  it("rejects a refund for a booking that doesn't belong to this hotel", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue(null);
    await expect(
      refundsService.requestRefund("hotelA", "u1", { bookingId: "b1", amount: 100, reason: "Guest complaint", method: "CARD" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects refunding against a payment that isn't PAID", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", paidAmount: 500 });
    mockedPrisma.payment.findFirst.mockResolvedValue({ id: "p1", status: "PENDING" });

    await expect(
      refundsService.requestRefund("hotelA", "u1", { bookingId: "b1", paymentId: "p1", amount: 100, reason: "Guest complaint", method: "CARD" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a refund amount exceeding the booking's refundable balance", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", paidAmount: 100 });
    mockedPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 50 } }); // already committed 50 of the 100 paid

    await expect(
      refundsService.requestRefund("hotelA", "u1", { bookingId: "b1", amount: 60, reason: "Overcharge", method: "CARD" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("creates a REQUESTED refund when within the refundable balance", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", paidAmount: 500 });
    mockedPrisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockedPrisma.refund.create.mockResolvedValue({ id: "r1", status: "REQUESTED" });

    const refund = await refundsService.requestRefund("hotelA", "u1", { bookingId: "b1", amount: 100, reason: "Early checkout", method: "CASH" });
    expect(refund.status).toBe("REQUESTED");
  });
});

describe("refundsService.decideRefund", () => {
  it("only allows deciding a REQUESTED refund", async () => {
    mockedPrisma.refund.findFirst.mockResolvedValue({ id: "r1", status: "APPROVED" });
    await expect(refundsService.decideRefund("hotelA", "r1", "mgr1", "APPROVED")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("requires a rejectionReason when rejecting", async () => {
    mockedPrisma.refund.findFirst.mockResolvedValue({ id: "r1", status: "REQUESTED" });
    await expect(refundsService.decideRefund("hotelA", "r1", "mgr1", "REJECTED")).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("refundsService.processRefund", () => {
  it("only allows processing an APPROVED refund", async () => {
    mockedPrisma.refund.findFirst.mockResolvedValue({ id: "r1", status: "REQUESTED" });
    await expect(refundsService.processRefund("hotelA", "r1", "mgr1")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("decrements the booking's paidAmount, flips a fully-refunded payment to REFUNDED, and posts a ledger debit", async () => {
    mockedPrisma.refund.findFirst.mockResolvedValue({
      id: "r1",
      status: "APPROVED",
      bookingId: "b1",
      paymentId: "p1",
      amount: 100,
      reason: "Early checkout",
      booking: { bookingRef: "BK-1" },
      payment: { id: "p1", amount: 100 },
    });
    mockedPrisma.refund.update.mockResolvedValue({ id: "r1", status: "PROCESSED" });

    await refundsService.processRefund("hotelA", "r1", "mgr1", "TXN-123");

    expect(mockedPrisma.booking.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { paidAmount: { decrement: 100 } } });
    expect(mockedPrisma.payment.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { status: "REFUNDED" } });
    expect(mockedPrisma.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "REFUND", direction: "DEBIT", amount: 100 }) })
    );
  });

  it("does not flip the payment to REFUNDED for a partial refund", async () => {
    mockedPrisma.refund.findFirst.mockResolvedValue({
      id: "r1",
      status: "APPROVED",
      bookingId: "b1",
      paymentId: "p1",
      amount: 40,
      reason: "Partial",
      booking: { bookingRef: "BK-1" },
      payment: { id: "p1", amount: 100 },
    });
    mockedPrisma.refund.update.mockResolvedValue({ id: "r1", status: "PROCESSED" });

    await refundsService.processRefund("hotelA", "r1", "mgr1");

    expect(mockedPrisma.payment.update).not.toHaveBeenCalled();
  });
});
