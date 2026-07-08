jest.mock("../src/config/database", () => {
  const prisma: any = {
    booking: { findFirst: jest.fn() },
    invoice: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn(), create: jest.fn(), update: jest.fn() },
    invoiceLineItem: { deleteMany: jest.fn() },
    ledgerEntry: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({}) },
    financialPeriodClose: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return { prisma };
});

import { prisma } from "../src/config/database";
import { invoicesService } from "../src/modules/financial/invoices/invoices.service";

const mockedPrisma = prisma as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockedPrisma.financialPeriodClose.findFirst.mockResolvedValue(null);
});

const baseLineItems = [{ description: "Deluxe Room x2 nights", quantity: 2, unitPrice: 1000, taxPercent: 5 }];

describe("invoicesService.createInvoice", () => {
  it("requires either a bookingId or a guestId", async () => {
    // Zod validation normally catches this at the route layer, but the
    // service itself should never silently create an orphan invoice.
    await expect(
      invoicesService.createInvoice("hotelA", "u1", { lineItems: baseLineItems, discount: 0, type: "STANDARD", asDraft: false })
    ).rejects.toBeTruthy();
  });

  it("rejects creating a second invoice for a booking that already has one", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", guestId: "g1" });
    mockedPrisma.invoice.findUnique.mockResolvedValue({ id: "existing", invoiceNumber: "INV-1" });

    await expect(
      invoicesService.createInvoice("hotelA", "u1", { bookingId: "b1", lineItems: baseLineItems, discount: 0, type: "STANDARD", asDraft: false })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("computes subtotal/tax/total correctly and posts ledger entries when issued (not draft)", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", guestId: "g1" });
    mockedPrisma.invoice.findUnique.mockResolvedValue(null);
    mockedPrisma.invoice.create.mockResolvedValue({ id: "inv1", invoiceNumber: "INV-202607-000001", subtotal: 2000, tax: 100, total: 2100 });

    const invoice = await invoicesService.createInvoice("hotelA", "u1", {
      bookingId: "b1",
      lineItems: baseLineItems,
      discount: 0,
      type: "STANDARD",
      asDraft: false,
    });

    expect(mockedPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subtotal: 2000, tax: 100, total: 2100, status: "ISSUED" }) })
    );
    // Revenue + tax ledger entries should both have been posted.
    expect(mockedPrisma.ledgerEntry.create).toHaveBeenCalledTimes(2);
    expect(invoice.id).toBe("inv1");
  });

  it("does not post ledger entries for a draft invoice", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", guestId: "g1" });
    mockedPrisma.invoice.findUnique.mockResolvedValue(null);
    mockedPrisma.invoice.create.mockResolvedValue({ id: "inv1", invoiceNumber: "INV-202607-000001", status: "DRAFT" });

    await invoicesService.createInvoice("hotelA", "u1", { bookingId: "b1", lineItems: baseLineItems, discount: 0, type: "PROFORMA", asDraft: true });

    expect(mockedPrisma.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it("blocks issuing an invoice when the hotel's financial period is already closed for today", async () => {
    mockedPrisma.booking.findFirst.mockResolvedValue({ id: "b1", hotelId: "hotelA", guestId: "g1" });
    mockedPrisma.invoice.findUnique.mockResolvedValue(null);
    mockedPrisma.financialPeriodClose.findFirst.mockResolvedValue({ businessDate: new Date(), status: "CLOSED" });

    await expect(
      invoicesService.createInvoice("hotelA", "u1", { bookingId: "b1", lineItems: baseLineItems, discount: 0, type: "STANDARD", asDraft: false })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("invoicesService.voidInvoice", () => {
  it("refuses to void an already-void invoice", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue({ id: "inv1", status: "VOID" });
    await expect(invoicesService.voidInvoice("hotelA", "inv1", "u1", "guest request")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("refuses to void a fully paid invoice", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue({ id: "inv1", status: "PAID" });
    await expect(invoicesService.voidInvoice("hotelA", "inv1", "u1", "guest request")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("posts an offsetting ADJUSTMENT ledger entry when voiding an issued invoice", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue({ id: "inv1", status: "ISSUED", subtotal: 2000, tax: 100, invoiceNumber: "INV-1", issuedAt: new Date() });
    mockedPrisma.invoice.update.mockResolvedValue({ id: "inv1", status: "VOID" });

    await invoicesService.voidInvoice("hotelA", "inv1", "u1", "guest cancelled");

    expect(mockedPrisma.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "ADJUSTMENT", direction: "DEBIT", amount: 2100 }) })
    );
  });
});

describe("invoicesService.markAdhocInvoicePaid", () => {
  it("refuses for booking-linked invoices (those are paid via the Payments module)", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue({ id: "inv1", bookingId: "b1", status: "ISSUED" });
    await expect(invoicesService.markAdhocInvoicePaid("hotelA", "inv1")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("refuses for draft/void invoices", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue({ id: "inv1", bookingId: null, status: "DRAFT" });
    await expect(invoicesService.markAdhocInvoicePaid("hotelA", "inv1")).rejects.toMatchObject({ statusCode: 409 });
  });
});
