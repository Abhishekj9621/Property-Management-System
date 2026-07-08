import { PrismaClient } from "@prisma/client";
import { taxRatesService } from "../src/modules/financial/tax-rates/tax-rates.service";
import { invoicesService } from "../src/modules/financial/invoices/invoices.service";
import { creditNotesService } from "../src/modules/financial/credit-notes/credit-notes.service";
import { refundsService } from "../src/modules/financial/refunds/refunds.service";
import { periodCloseService } from "../src/modules/financial/period-close/period-close.service";

const prisma = new PrismaClient();

/**
 * Seeds Financial Management module demo data on top of the base
 * `prisma/seed.ts` data set. Deliberately reuses the module's own service
 * functions (rather than writing rows directly) so every seeded record
 * goes through the same validation and ledger-posting logic a real
 * request would — this also doubles as a lightweight smoke test that the
 * module's core workflows run end-to-end against a real database.
 *
 * Run with: npm run seed:financial   (after the base `npm run seed`)
 */
async function main() {
  console.log("🌱 Seeding Financial Management module demo data...");

  const hotel = await prisma.hotel.findUniqueOrThrow({ where: { slug: "novastay-downtown" } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@novastay.com" } });
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: "manager@novastay.com" } });
  const guest = await prisma.guest.findFirstOrThrow({ where: { hotelId: hotel.id, email: "casey.guest@example.com" } });
  const demoBooking = await prisma.booking.findFirstOrThrow({ where: { hotelId: hotel.id, guestId: guest.id, status: "CHECKED_OUT" } });
  const demoPayment = await prisma.payment.findFirstOrThrow({ where: { bookingId: demoBooking.id } });

  // ---------------------------------------------------------------
  // 1. Tax rates — one platform-wide default, one hotel-specific override
  // ---------------------------------------------------------------
  const existingRates = await taxRatesService.listForHotel(hotel.id, true);
  if (existingRates.length === 0) {
    await prisma.taxRate.create({ data: { hotelId: null, name: "GST — Standard", code: "GST-STD", percentage: 5, isDefault: true } });
    await taxRatesService.createTaxRate(hotel.id, { name: "Luxury Room Tax", code: "LUX-TAX", percentage: 12, isDefault: true });
    console.log("   ✔ Tax rates seeded (platform default + hotel override)");
  } else {
    console.log("   • Tax rates already present, skipping");
  }

  // ---------------------------------------------------------------
  // 2. Invoice for the existing demo (checked-out, paid) booking
  // ---------------------------------------------------------------
  let bookingInvoice = await prisma.invoice.findUnique({ where: { bookingId: demoBooking.id } });
  if (!bookingInvoice) {
    bookingInvoice = await invoicesService.createInvoice(hotel.id, admin.id, {
      bookingId: demoBooking.id,
      guestId: guest.id,
      type: "STANDARD",
      asDraft: false,
      discount: 0,
      lineItems: [{ description: "Deluxe Room — 2 nights", quantity: 2, unitPrice: 100, taxPercent: 9 }],
    });
    console.log(`   ✔ Invoice ${bookingInvoice.invoiceNumber} created for booking ${demoBooking.bookingRef}`);
  } else {
    console.log("   • Booking invoice already exists, skipping");
  }

  // ---------------------------------------------------------------
  // 3. Ad-hoc (non-booking) corporate invoice + a partial credit note
  // ---------------------------------------------------------------
  const adhocExisting = await prisma.invoice.findFirst({ where: { hotelId: hotel.id, notes: "Seed: ad-hoc corporate banquet invoice" } });
  let adhocInvoice = adhocExisting;
  if (!adhocInvoice) {
    adhocInvoice = await invoicesService.createInvoice(hotel.id, admin.id, {
      guestId: guest.id,
      type: "STANDARD",
      asDraft: false,
      discount: 500,
      notes: "Seed: ad-hoc corporate banquet invoice",
      lineItems: [
        { description: "Conference Hall — full day rental", quantity: 1, unitPrice: 15000, taxPercent: 18 },
        { description: "Catering — 40 pax", quantity: 40, unitPrice: 350, taxPercent: 5 },
      ],
    });
    console.log(`   ✔ Ad-hoc invoice ${adhocInvoice.invoiceNumber} created (corporate banquet)`);

    const creditNote = await creditNotesService.issueCreditNote(hotel.id, manager.id, {
      invoiceId: adhocInvoice.id,
      amount: 750,
      reason: "AV equipment failure during event — partial goodwill credit",
    });
    console.log(`   ✔ Credit note ${creditNote.creditNoteNumber} issued against ${adhocInvoice.invoiceNumber}`);
  } else {
    console.log("   • Ad-hoc invoice already exists, skipping");
  }

  // ---------------------------------------------------------------
  // 4. A refund request left mid-workflow (REQUESTED), so the Refunds
  //    page has something for a manager to approve/reject/process.
  // ---------------------------------------------------------------
  const existingRefund = await prisma.refund.findFirst({ where: { bookingId: demoBooking.id } });
  if (!existingRefund) {
    const refund = await refundsService.requestRefund(hotel.id, admin.id, {
      bookingId: demoBooking.id,
      paymentId: demoPayment.id,
      amount: 20,
      reason: "Guest reported a slow check-in — partial goodwill refund",
      method: "CARD",
    });
    console.log(`   ✔ Refund request seeded (₹${refund.amount}, status ${refund.status})`);
  } else {
    console.log("   • Demo refund already exists, skipping");
  }

  // ---------------------------------------------------------------
  // 5. Close the books for a past business date, to populate the
  //    Day-End / Night Audit history.
  // ---------------------------------------------------------------
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const businessDate = twoDaysAgo.toISOString().slice(0, 10);

  const existingClose = await prisma.financialPeriodClose.findUnique({
    where: { hotelId_businessDate: { hotelId: hotel.id, businessDate: new Date(businessDate) } },
  });
  if (!existingClose) {
    const close = await periodCloseService.closeDay(hotel.id, admin.id, businessDate, "Seed: routine night audit close");
    console.log(`   ✔ Financial period closed for ${businessDate} (net cash ₹${close.netCashPosition})`);
  } else {
    console.log("   • Financial period close already exists for that date, skipping");
  }

  console.log("✅ Financial Management seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
