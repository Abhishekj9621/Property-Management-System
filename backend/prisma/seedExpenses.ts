import { PrismaClient } from "@prisma/client";
import { expensesService } from "../src/modules/expenses/expenses.service";
import { vendorsService } from "../src/modules/expenses/vendors/vendors.service";
import { budgetsService } from "../src/modules/expenses/budgets/budgets.service";
import { recurringExpenseService } from "../src/modules/expenses/recurring/recurring.service";

const prisma = new PrismaClient();

/**
 * Seeds Expense Management module demo data on top of the base
 * `prisma/seed.ts` data set. Reuses the module's own service functions
 * (rather than writing rows directly) wherever the workflow allows, so
 * seeded data is validated the same way a real request would be — this
 * also doubles as a lightweight smoke test that the module's core
 * workflows run end-to-end against a real database.
 *
 * Run with: npm run seed:expenses   (after the base `npm run seed`)
 */
async function main() {
  console.log("🌱 Seeding Expense Management module demo data...");

  const hotel = await prisma.hotel.findUniqueOrThrow({ where: { slug: "novastay-downtown" } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@novastay.com" } });
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: "manager@novastay.com" } });

  // ---------------------------------------------------------------
  // 1. High-value approval threshold — expenses of ₹50,000+ will need
  //    HOTEL_ADMIN/SUPER_ADMIN approval instead of just a MANAGER.
  // ---------------------------------------------------------------
  await prisma.hotel.update({ where: { id: hotel.id }, data: { highValueExpenseThreshold: 50000 } });
  console.log("   ✔ High-value expense threshold set to ₹50,000");

  // ---------------------------------------------------------------
  // 2. Categories
  // ---------------------------------------------------------------
  const categoryNames = ["Utilities", "Maintenance & Repairs", "Office Supplies", "Marketing", "Staff Welfare"];
  const categories: Record<string, any> = {};
  for (const name of categoryNames) {
    const existing = await prisma.expenseCategory.findFirst({ where: { hotelId: hotel.id, name } });
    categories[name] = existing ?? (await expensesService.createCategory(hotel.id, { name }));
  }
  console.log(`   ✔ ${categoryNames.length} expense categories ready`);

  // ---------------------------------------------------------------
  // 3. Vendors — two hotel-scoped, one platform-wide
  // ---------------------------------------------------------------
  let acme = await prisma.vendor.findFirst({ where: { hotelId: hotel.id, name: "ACME Facility Services" } });
  if (!acme) {
    acme = await vendorsService.create(hotel.id, admin.id, {
      name: "ACME Facility Services",
      contactName: "Rohan Mehta",
      email: "billing@acmefacility.example",
      phone: "+91-98765-43210",
      paymentTerms: "Net 30",
    });
  }
  let grandSupplies = await prisma.vendor.findFirst({ where: { hotelId: hotel.id, name: "Grand Supplies Co" } });
  if (!grandSupplies) {
    grandSupplies = await vendorsService.create(hotel.id, admin.id, { name: "Grand Supplies Co", paymentTerms: "Net 15" });
  }
  const globalPayroll = await prisma.vendor.upsert({
    where: { hotelId_name: { hotelId: null as any, name: "Global Payroll Services" } },
    update: {},
    create: { hotelId: null, name: "Global Payroll Services", paymentTerms: "Net 30", createdById: admin.id },
  });
  console.log("   ✔ Vendors ready (2 hotel-scoped, 1 platform-wide)");

  // ---------------------------------------------------------------
  // 4. Budgets — this month's Utilities budget + an annual overall budget
  // ---------------------------------------------------------------
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const existingUtilBudget = await prisma.expenseBudget.findUnique({
    where: { hotelId_categoryId_year_month: { hotelId: hotel.id, categoryId: categories["Utilities"].id, year, month } },
  });
  if (!existingUtilBudget) {
    await budgetsService.create(hotel.id, { categoryId: categories["Utilities"].id, year, month, amount: 15000, alertThresholdPercent: 80 });
  }
  const existingOverallBudget = await prisma.expenseBudget.findUnique({
    where: { hotelId_categoryId_year_month: { hotelId: hotel.id, categoryId: null as any, year, month: null as any } },
  });
  if (!existingOverallBudget) {
    await budgetsService.create(hotel.id, { year, amount: 500000, alertThresholdPercent: 90 });
  }
  console.log("   ✔ Budgets ready (Utilities monthly + overall annual)");

  // ---------------------------------------------------------------
  // 5. Recurring expense — Monthly internet bill, with its first
  //    occurrence actually generated via the real sweep logic.
  // ---------------------------------------------------------------
  let recurringInternet = await prisma.recurringExpense.findFirst({ where: { hotelId: hotel.id, title: "Monthly Internet & Phone Bill" } });
  if (!recurringInternet) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    recurringInternet = await recurringExpenseService.create(hotel.id, admin.id, {
      title: "Monthly Internet & Phone Bill",
      description: "ISP + landline bundle for the front office",
      amount: 4500,
      categoryId: categories["Utilities"].id,
      vendorId: acme.id,
      frequency: "MONTHLY",
      startDate: startDate.toISOString(),
    });
    const generated = await recurringExpenseService.runDueRecurringExpenses(new Date());
    console.log(`   ✔ Recurring expense created; ${generated.length} occurrence(s) generated by the sweep`);
  } else {
    console.log("   • Recurring expense already exists, skipping");
  }

  // ---------------------------------------------------------------
  // 6. Sample expenses covering the full workflow
  // ---------------------------------------------------------------
  const sample = async (title: string, opts: Parameters<typeof expensesService.createExpense>[2]) => {
    const existing = await prisma.expense.findFirst({ where: { hotelId: hotel.id, title } });
    if (existing) return existing;
    return expensesService.createExpense(hotel.id, manager.id, { title, ...opts });
  };

  // Still pending manager review.
  await sample("Front desk stationery restock", { amount: 2200, categoryId: categories["Office Supplies"].id, vendorId: grandSupplies.id, isReimbursable: false });

  // Approved, then reimbursed.
  const reimbursable = await sample("Staff welfare lunch — housekeeping team", {
    amount: 3200,
    categoryId: categories["Staff Welfare"].id,
    isReimbursable: true,
  });
  if (reimbursable.status === "SUBMITTED") {
    const approved = await expensesService.decideExpense(hotel.id, reimbursable.id, admin.id, "HOTEL_ADMIN", "APPROVED", {});
    await expensesService.decideExpense(hotel.id, approved.id, admin.id, "HOTEL_ADMIN", "REIMBURSED", { paymentMethod: "BANK_TRANSFER", paymentReference: "TXN-REIMB-0001" });
  }

  // Rejected, with a reason.
  const rejected = await sample("Premium social media ad boost", { amount: 8000, categoryId: categories["Marketing"].id });
  if (rejected.status === "SUBMITTED") {
    await expensesService.decideExpense(hotel.id, rejected.id, admin.id, "HOTEL_ADMIN", "REJECTED", { rejectionReason: "Marketing spend already covered this quarter — resubmit next quarter" });
  }

  // Approved and paid to an external vendor.
  const paid = await sample("HVAC annual maintenance contract", { amount: 12000, categoryId: categories["Maintenance & Repairs"].id, vendorId: acme.id });
  if (paid.status === "SUBMITTED") {
    const approvedPaid = await expensesService.decideExpense(hotel.id, paid.id, admin.id, "HOTEL_ADMIN", "APPROVED", {});
    await expensesService.decideExpense(hotel.id, approvedPaid.id, admin.id, "HOTEL_ADMIN", "PAID", { paymentMethod: "BANK_TRANSFER", paymentReference: "TXN-PAID-0007" });
  }

  // High-value expense (above the ₹50,000 threshold) — demonstrates the
  // multi-level approval rule; left SUBMITTED so a HOTEL_ADMIN/SUPER_ADMIN
  // can approve it by hand during manual testing (a MANAGER will get a 403).
  await sample("Annual payroll processing contract", { amount: 65000, vendorId: globalPayroll.id });

  console.log("✅ Expense Management seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
