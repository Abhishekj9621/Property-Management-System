import { Prisma, LedgerEntryType, LedgerDirection, LedgerSourceType } from "@prisma/client";
import { prisma } from "../../../config/database";
import { ApiError } from "../../../utils/ApiError";

/**
 * Generates a sequential, human-readable document number for the given
 * prefix — e.g. INV-202607-000123, CN-202607-000004, REF-202607-000012.
 * Scoped per-hotel-per-month via a simple count query. This is adequate
 * for a modular monolith at NovaStay's scale; if two requests raced on the
 * exact same millisecond a unique-constraint retry would be needed, but the
 * unique DB constraint on the number column guarantees no duplicate is ever
 * persisted even in that rare case — callers should retry once on a unique
 * violation.
 */
export async function generateDocumentNumber(prefix: string, hotelId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const count = await (tx as any).ledgerEntry.count({
    where: { hotelId, createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
  });
  const sequence = String(count + 1).padStart(6, "0");
  return `${prefix}-${yyyymm}-${sequence}`;
}

/**
 * Throws if `date` falls on or before the most recent CLOSED business date
 * for this hotel. Used by every financial write (invoices, refunds, credit
 * notes, manual ledger entries) so a closed day-end/night-audit can never
 * be silently amended.
 */
export async function assertPeriodOpen(hotelId: string, date: Date, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const asOfDate = new Date(date);
  asOfDate.setHours(0, 0, 0, 0);

  const blockingClose = await (tx as any).financialPeriodClose.findFirst({
    where: { hotelId, status: "CLOSED", businessDate: { gte: asOfDate } },
    orderBy: { businessDate: "desc" },
  });

  if (blockingClose) {
    throw ApiError.conflict(
      `The financial period for ${new Date(blockingClose.businessDate).toISOString().slice(0, 10)} is already closed. Reopen it before making changes dated on or before that day.`
    );
  }
}

interface PostLedgerEntryInput {
  hotelId: string;
  type: LedgerEntryType;
  direction: LedgerDirection;
  amount: number;
  description: string;
  sourceType: LedgerSourceType;
  sourceId?: string;
  referenceCode?: string;
  createdById?: string | null;
  entryDate?: Date;
}

/** Appends one immutable row to the general ledger. Never updates or
 * deletes — corrections are made with an offsetting ADJUSTMENT entry. */
export async function postLedgerEntry(input: PostLedgerEntryInput, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  if (input.amount <= 0) throw ApiError.badRequest("Ledger entry amount must be greater than zero");
  return (tx as any).ledgerEntry.create({
    data: {
      hotelId: input.hotelId,
      type: input.type,
      direction: input.direction,
      amount: input.amount,
      description: input.description,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      referenceCode: input.referenceCode,
      createdById: input.createdById ?? null,
      entryDate: input.entryDate ?? new Date(),
    },
  });
}
