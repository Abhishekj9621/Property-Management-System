jest.mock("../src/config/database", () => {
  const prisma: any = {
    invoice: { findFirst: jest.fn() },
    creditNote: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    ledgerEntry: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({}) },
    financialPeriodClose: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return { prisma };
});

import { prisma } from "../src/config/database";
import { creditNotesService } from "../src/modules/financial/credit-notes/credit-notes.service";

const mockedPrisma = prisma as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockedPrisma.financialPeriodClose.findFirst.mockResolvedValue(null);
});

describe("creditNotesService.issueCreditNote", () => {
  it("rejects issuing against a DRAFT or VOID invoice", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue({ id: "inv1", status: "DRAFT", total: 1000 });
    await expect(creditNotesService.issueCreditNote("hotelA", "u1", { invoiceId: "inv1", amount: 100, reason: "Damaged room" })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("rejects a credit note amount that would exceed the invoice total once combined with prior credits", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue({ id: "inv1", status: "ISSUED", total: 1000, invoiceNumber: "INV-1" });
    mockedPrisma.creditNote.aggregate.mockResolvedValue({ _sum: { amount: 900 } });

    await expect(creditNotesService.issueCreditNote("hotelA", "u1", { invoiceId: "inv1", amount: 200, reason: "Service issue" })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("issues the credit note and posts an ADJUSTMENT ledger debit", async () => {
    mockedPrisma.invoice.findFirst.mockResolvedValue({ id: "inv1", status: "ISSUED", total: 1000, invoiceNumber: "INV-1" });
    mockedPrisma.creditNote.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockedPrisma.creditNote.create.mockResolvedValue({ id: "cn1", creditNoteNumber: "CN-202607-000001", amount: 150 });

    const creditNote = await creditNotesService.issueCreditNote("hotelA", "u1", { invoiceId: "inv1", amount: 150, reason: "Noise complaint" });

    expect(creditNote.id).toBe("cn1");
    expect(mockedPrisma.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "ADJUSTMENT", direction: "DEBIT", amount: 150 }) })
    );
  });
});

describe("creditNotesService.voidCreditNote", () => {
  it("refuses to void an already-void credit note", async () => {
    mockedPrisma.creditNote.findFirst.mockResolvedValue({ id: "cn1", status: "VOID" });
    await expect(creditNotesService.voidCreditNote("hotelA", "cn1", "u1")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("posts a reversing CREDIT ledger entry when voiding", async () => {
    mockedPrisma.creditNote.findFirst.mockResolvedValue({ id: "cn1", status: "ISSUED", amount: 150, creditNoteNumber: "CN-1" });
    mockedPrisma.creditNote.update.mockResolvedValue({ id: "cn1", status: "VOID" });

    await creditNotesService.voidCreditNote("hotelA", "cn1", "u1");

    expect(mockedPrisma.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "ADJUSTMENT", direction: "CREDIT", amount: 150 }) })
    );
  });
});
