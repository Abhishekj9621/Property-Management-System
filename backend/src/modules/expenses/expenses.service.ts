import { prisma } from "../../config/database";
import { ApiError } from "../../utils/ApiError";
import { Prisma } from "@prisma/client";
import { EXPENSE_MANAGERS, EXPENSE_HIGH_VALUE_APPROVERS } from "./shared/expense.roles";
import { notificationsService } from "../notifications/notifications.service";
import { checkBudgetAfterSpend } from "./budgets/budgets.service";

const includeGraph = {
  category: true,
  vendorRecord: { select: { id: true, name: true, contactName: true, phone: true, email: true } },
  attachments: true,
  submittedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
};

export const expensesService = {
  async createExpense(hotelId: string, submittedById: string | undefined, data: any) {
    if (data.categoryId) {
      const category = await prisma.expenseCategory.findFirst({
        where: { id: data.categoryId, OR: [{ hotelId }, { hotelId: null }] },
      });
      if (!category) throw ApiError.badRequest("Expense category not found");
    }
    if (data.vendorId) {
      const vendor = await prisma.vendor.findFirst({ where: { id: data.vendorId, OR: [{ hotelId }, { hotelId: null }] } });
      if (!vendor) throw ApiError.badRequest("Vendor not found");
    }

    const { attachments, ...rest } = data;

    const expense = await prisma.expense.create({
      data: {
        ...rest,
        hotelId,
        submittedById,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
        status: "SUBMITTED",
        attachments: attachments?.length ? { create: attachments.map((a: any) => ({ url: a.url, fileName: a.fileName, uploadedById: submittedById })) } : undefined,
      },
      include: includeGraph,
    });

    // Budget visibility: let managers know as soon as a new claim would tip
    // a category over its alert threshold, rather than only finding out at
    // month-end reporting.
    await checkBudgetAfterSpend(hotelId, expense.categoryId, expense.expenseDate, Number(expense.amount)).catch(() => undefined);

    return expense;
  },

  async listExpenses(
    hotelId: string,
    filters: {
      status?: string;
      isReimbursable?: string;
      submittedById?: string;
      vendorId?: string;
      categoryId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const where: Prisma.ExpenseWhereInput = {
      hotelId,
      ...(filters.status ? { status: filters.status as any } : {}),
      ...(filters.isReimbursable !== undefined ? { isReimbursable: filters.isReimbursable === "true" } : {}),
      ...(filters.submittedById ? { submittedById: filters.submittedById } : {}),
      ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.from || filters.to
        ? {
            expenseDate: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total, summary] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: includeGraph,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
      prisma.expense.groupBy({ by: ["status"], where, _sum: { amount: true } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary: summary.map((s: any) => ({ status: s.status, total: Number(s._sum.amount ?? 0) })),
    };
  },

  async getExpense(hotelId: string, id: string) {
    const expense = await prisma.expense.findFirst({ where: { id, hotelId }, include: includeGraph });
    if (!expense) throw ApiError.notFound("Expense not found");
    return expense;
  },

  // Only the original submitter (while still SUBMITTED/DRAFT) or a manager
  // may edit an expense — once decided, the record becomes an audit trail.
  async updateExpense(hotelId: string, id: string, requesterId: string | undefined, isManager: boolean, data: any) {
    const existing = await prisma.expense.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Expense not found");
    if (!["DRAFT", "SUBMITTED"].includes(existing.status)) {
      throw ApiError.conflict("Only draft or submitted expenses can be edited");
    }
    if (!isManager && existing.submittedById !== requesterId) {
      throw ApiError.forbidden("You can only edit your own expense claims");
    }
    if (data.vendorId) {
      const vendor = await prisma.vendor.findFirst({ where: { id: data.vendorId, OR: [{ hotelId }, { hotelId: null }] } });
      if (!vendor) throw ApiError.badRequest("Vendor not found");
    }

    return prisma.expense.update({
      where: { id },
      data: { ...data, expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined },
      include: includeGraph,
    });
  },

  async addAttachment(hotelId: string, id: string, uploadedById: string | undefined, url: string, fileName?: string) {
    const existing = await prisma.expense.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Expense not found");
    await prisma.expenseAttachment.create({ data: { expenseId: id, url, fileName, uploadedById } });
    return this.getExpense(hotelId, id);
  },

  async removeAttachment(hotelId: string, expenseId: string, attachmentId: string) {
    const expense = await prisma.expense.findFirst({ where: { id: expenseId, hotelId } });
    if (!expense) throw ApiError.notFound("Expense not found");
    const attachment = await prisma.expenseAttachment.findFirst({ where: { id: attachmentId, expenseId } });
    if (!attachment) throw ApiError.notFound("Attachment not found");
    await prisma.expenseAttachment.delete({ where: { id: attachmentId } });
    return this.getExpense(hotelId, expenseId);
  },

  /**
   * Approve / reject / mark reimbursed or paid.
   *
   * Multi-level approval: if the hotel has a `highValueExpenseThreshold`
   * configured and this expense's amount meets or exceeds it, only
   * HOTEL_ADMIN/SUPER_ADMIN (EXPENSE_HIGH_VALUE_APPROVERS) may move it from
   * SUBMITTED to APPROVED — a plain MANAGER is turned back with a 403
   * naming who can approve it instead. Every other transition (reject,
   * reimburse, pay) is unaffected by the threshold.
   */
  async decideExpense(
    hotelId: string,
    id: string,
    approverId: string | undefined,
    approverRole: string | undefined,
    status: string,
    extra: { rejectionReason?: string; paymentMethod?: string; paymentReference?: string }
  ) {
    const existing = await prisma.expense.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Expense not found");

    const validTransitions: Record<string, string[]> = {
      SUBMITTED: ["APPROVED", "REJECTED"],
      APPROVED: ["REIMBURSED", "PAID"],
    };
    if (!validTransitions[existing.status]?.includes(status)) {
      throw ApiError.conflict(`Cannot move expense from ${existing.status} to ${status}`);
    }
    if (status === "REJECTED" && !extra.rejectionReason) {
      throw ApiError.badRequest("rejectionReason is required when rejecting an expense");
    }

    if (status === "APPROVED") {
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { highValueExpenseThreshold: true } });
      const threshold = hotel?.highValueExpenseThreshold ? Number(hotel.highValueExpenseThreshold) : null;
      if (threshold !== null && Number(existing.amount) >= threshold && !EXPENSE_HIGH_VALUE_APPROVERS.includes(approverRole ?? "")) {
        throw ApiError.forbidden(
          `This expense (₹${existing.amount}) is at or above the hotel's high-value threshold (₹${threshold}) and requires Hotel Admin or Super Admin approval`
        );
      }
    }

    return prisma.expense.update({
      where: { id },
      data: {
        status: status as any,
        approvedById: approverId,
        approvedAt: new Date(),
        rejectionReason: status === "REJECTED" ? extra.rejectionReason : null,
        paymentMethod: ["REIMBURSED", "PAID"].includes(status) ? (extra.paymentMethod as any) : undefined,
        paymentReference: ["REIMBURSED", "PAID"].includes(status) ? extra.paymentReference : undefined,
        paidAt: ["REIMBURSED", "PAID"].includes(status) ? new Date() : undefined,
      },
      include: includeGraph,
    });
  },

  async deleteExpense(hotelId: string, id: string) {
    const existing = await prisma.expense.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Expense not found");
    if (!["DRAFT", "SUBMITTED", "REJECTED"].includes(existing.status)) {
      throw ApiError.conflict("Only draft, submitted, or rejected expenses can be deleted");
    }
    await prisma.expense.delete({ where: { id } });
    return { id };
  },

  // --- Categories ---

  async listCategories(hotelId: string, includeInactive = false) {
    return prisma.expenseCategory.findMany({
      where: { OR: [{ hotelId }, { hotelId: null }], ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" },
    });
  },

  async createCategory(hotelId: string, data: { name: string; code?: string }) {
    return prisma.expenseCategory.create({ data: { ...data, hotelId } });
  },

  async updateCategory(hotelId: string, id: string, data: any) {
    const existing = await prisma.expenseCategory.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Expense category not found (platform-wide categories can only be edited by a Super Admin)");
    return prisma.expenseCategory.update({ where: { id }, data });
  },
};
