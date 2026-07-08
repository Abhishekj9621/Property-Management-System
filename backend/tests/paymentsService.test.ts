jest.mock("../src/config/database", () => {
  const prisma: any = {
    booking: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return { prisma };
});

jest.mock("../src/modules/financial/invoices/invoices.service", () => ({
  syncInvoiceForBooking: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../src/config/database";
import { paymentsService } from "../src/modules/payments/payments.service";
import { syncInvoiceForBooking } from "../src/modules/financial/invoices/invoices.service";

const mockedPrisma = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe("paymentsService.recordPayment", () => {
  it("rejects a zero or negative amount", async () => {
    await expect(paymentsService.recordPayment("hotelA", "b1", 0, "CASH")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("404s when the booking doesn't belong to this hotel", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue(null);
    await expect(paymentsService.recordPayment("hotelA", "b1", 100, "CASH")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("atomically increments the booking's paidAmount and syncs any linked invoice", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", guest: {}, hotel: {}, bookingRef: "BK-1" });
    mockedPrisma.payment.create.mockResolvedValue({ id: "p1", bookingId: "b1", amount: 100 });
    mockedPrisma.booking.update.mockResolvedValue({ paidAmount: 100, totalAmount: 200 });

    const payment = await paymentsService.recordPayment("hotelA", "b1", 100, "CASH");

    expect(mockedPrisma.booking.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { paidAmount: { increment: 100 } } });
    expect(syncInvoiceForBooking).toHaveBeenCalledWith("b1", expect.anything());
    expect(payment.isFullyPaid).toBe(false);
  });

  it("flags the booking as fully paid once paidAmount reaches totalAmount", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", guest: {}, hotel: {}, bookingRef: "BK-1" });
    mockedPrisma.payment.create.mockResolvedValue({ id: "p1", bookingId: "b1", amount: 100 });
    mockedPrisma.booking.update.mockResolvedValue({ paidAmount: 200, totalAmount: 200 });

    const payment = await paymentsService.recordPayment("hotelA", "b1", 100, "CASH");
    expect(payment.isFullyPaid).toBe(true);
  });

  describe("webhook idempotency (audit fix)", () => {
    it("does not double-credit a booking when the same stripePaymentId is recorded twice", async () => {
      mockedPrisma.booking.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", guest: {}, hotel: {}, bookingRef: "BK-1" });
      // Simulate: this Stripe PaymentIntent was already recorded once.
      mockedPrisma.payment.findFirst.mockResolvedValue({ id: "existing-payment", bookingId: "b1", amount: 100, stripePaymentId: "pi_123" });

      const payment = await paymentsService.recordPayment("hotelA", "b1", 100, "CARD", { stripePaymentId: "pi_123" });

      expect(payment.id).toBe("existing-payment");
      // Must NOT create a second payment or increment paidAmount again.
      expect(mockedPrisma.payment.create).not.toHaveBeenCalled();
      expect(mockedPrisma.booking.update).not.toHaveBeenCalled();
      expect(syncInvoiceForBooking).not.toHaveBeenCalled();
    });

    it("records normally and stores stripePaymentId the first time it's seen", async () => {
      mockedPrisma.booking.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", guest: {}, hotel: {}, bookingRef: "BK-1" });
      mockedPrisma.payment.findFirst.mockResolvedValue(null);
      mockedPrisma.payment.create.mockResolvedValue({ id: "p1", bookingId: "b1", amount: 100, stripePaymentId: "pi_456" });
      mockedPrisma.booking.update.mockResolvedValue({ paidAmount: 100, totalAmount: 200 });

      await paymentsService.recordPayment("hotelA", "b1", 100, "CARD", { stripePaymentId: "pi_456" });

      expect(mockedPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ stripePaymentId: "pi_456" }) })
      );
    });
  });
});
