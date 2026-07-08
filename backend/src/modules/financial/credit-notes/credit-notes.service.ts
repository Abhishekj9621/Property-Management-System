import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { ApiError } from "../../../utils/ApiError";
import { generateDocumentNumber, postLedgerEntry, assertPeriodOpen } from "../shared/ledger.helper";

const includeGraph = {
  invoice: { select: { id: true, invoiceNumber: true, total: true, hotelId: true } },
  issuedBy: { select: { id: true, firstName: true, lastName: true } },
};

export const creditNotesService = {
  async issueCreditNote(hotelId: string, issuedById: string | undefined, data: { invoiceId: string; amount: number; reason: string }) {
    const invoice = await prisma.invoice.findFirst({ where: { id: data.invoiceId, hotelId } });
    if (!invoice) throw ApiError.notFound("Invoice not found");
    if (invoice.status === "DRAFT" || invoice.status === "VOID") {
      throw ApiError.conflict(`Cannot issue a credit note against a ${invoice.status} invoice`);
    }

    const existingCredits = await prisma.creditNote.aggregate({
      where: { invoiceId: invoice.id, status: "ISSUED" },
      _sum: { amount: true },
    });
    const alreadyCredited = Number(existingCredits._sum.amount ?? 0);
    if (alreadyCredited + data.amount > Number(invoice.total)) {
      throw ApiError.badRequest(
        `Credit note amount exceeds invoice total. Already credited: ${alreadyCredited}, invoice total: ${invoice.total}`
      );
    }

    const issuedAt = new Date();
    await assertPeriodOpen(hotelId, issuedAt);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const creditNoteNumber = await generateDocumentNumber("CN", hotelId, tx);
      const creditNote = await tx.creditNote.create({
        data: {
          hotelId,
          invoiceId: invoice.id,
          creditNoteNumber,
          reason: data.reason,
          amount: data.amount,
          issuedById,
        },
        include: includeGraph,
      });

      await postLedgerEntry(
        {
          hotelId,
          type: "ADJUSTMENT",
          direction: "DEBIT",
          amount: data.amount,
          description: `Credit note ${creditNoteNumber} issued against invoice ${invoice.invoiceNumber} — ${data.reason}`,
          sourceType: "CREDIT_NOTE",
          sourceId: creditNote.id,
          referenceCode: creditNoteNumber,
          createdById: issuedById,
          entryDate: issuedAt,
        },
        tx
      );

      return creditNote;
    });
  },

  async listCreditNotes(hotelId: string, filters: { invoiceId?: string; status?: string; page?: number; limit?: number }) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;
    const where: Prisma.CreditNoteWhereInput = {
      hotelId,
      ...(filters.invoiceId ? { invoiceId: filters.invoiceId } : {}),
      ...(filters.status ? { status: filters.status as any } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.creditNote.findMany({ where, include: includeGraph, orderBy: { issuedAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.creditNote.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async getCreditNote(hotelId: string, id: string) {
    const creditNote = await prisma.creditNote.findFirst({ where: { id, hotelId }, include: includeGraph });
    if (!creditNote) throw ApiError.notFound("Credit note not found");
    return creditNote;
  },

  async voidCreditNote(hotelId: string, id: string, actorId: string | undefined) {
    const existing = await prisma.creditNote.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Credit note not found");
    if (existing.status === "VOID") throw ApiError.conflict("Credit note is already void");

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const creditNote = await tx.creditNote.update({ where: { id }, data: { status: "VOID", voidedAt: new Date() }, include: includeGraph });
      await postLedgerEntry(
        {
          hotelId,
          type: "ADJUSTMENT",
          direction: "CREDIT",
          amount: Number(existing.amount),
          description: `Credit note ${existing.creditNoteNumber} voided (reversal)`,
          sourceType: "CREDIT_NOTE",
          sourceId: creditNote.id,
          referenceCode: creditNote.creditNoteNumber,
          createdById: actorId,
        },
        tx
      );
      return creditNote;
    });
  },
};
