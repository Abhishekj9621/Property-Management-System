import { prisma } from "../../../config/database";
import { ApiError } from "../../../utils/ApiError";

export const vendorsService = {
  async list(hotelId: string, includeInactive = false) {
    return prisma.vendor.findMany({
      where: { OR: [{ hotelId }, { hotelId: null }], ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" },
    });
  },

  async get(hotelId: string, id: string) {
    const vendor = await prisma.vendor.findFirst({ where: { id, OR: [{ hotelId }, { hotelId: null }] } });
    if (!vendor) throw ApiError.notFound("Vendor not found");
    return vendor;
  },

  async create(hotelId: string, createdById: string | undefined, data: any) {
    try {
      return await prisma.vendor.create({ data: { ...data, hotelId, createdById } });
    } catch (err: any) {
      if (err?.code === "P2002") throw ApiError.conflict("A vendor with this name already exists for this hotel");
      throw err;
    }
  },

  async update(hotelId: string, id: string, data: any) {
    const existing = await prisma.vendor.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Vendor not found (platform-wide vendors can only be edited by a Super Admin)");
    return prisma.vendor.update({ where: { id }, data });
  },

  async deactivate(hotelId: string, id: string) {
    const existing = await prisma.vendor.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Vendor not found");
    await prisma.vendor.update({ where: { id }, data: { isActive: false } });
    return { id };
  },

  /** Total spend with this vendor, for a quick "how much have we paid X" view. */
  async spendSummary(hotelId: string, id: string) {
    const vendor = await this.get(hotelId, id);
    const agg = await prisma.expense.aggregate({
      where: { hotelId, vendorId: id, status: { in: ["APPROVED", "REIMBURSED", "PAID"] } },
      _sum: { amount: true },
      _count: true,
    });
    return { vendor, totalSpend: Number(agg._sum.amount ?? 0), expenseCount: agg._count };
  },
};
