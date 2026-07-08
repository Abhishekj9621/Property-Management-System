import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { ApiError } from "../../../utils/ApiError";

export const taxRatesService = {
  /** Every hotel-specific rate plus any platform-wide (hotelId = null) rate
   * that the hotel hasn't overridden by name. */
  async listForHotel(hotelId: string, includeInactive = false) {
    return prisma.taxRate.findMany({
      where: { OR: [{ hotelId }, { hotelId: null }], ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  },

  async createTaxRate(hotelId: string, data: { name: string; code?: string; percentage: number; isDefault: boolean }) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (data.isDefault) {
        await tx.taxRate.updateMany({ where: { hotelId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.taxRate.create({ data: { ...data, hotelId } });
    });
  },

  async updateTaxRate(hotelId: string, id: string, data: any) {
    const existing = await prisma.taxRate.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Tax rate not found (platform-wide defaults can only be edited by a Super Admin)");

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (data.isDefault) {
        await tx.taxRate.updateMany({ where: { hotelId, isDefault: true, NOT: { id } }, data: { isDefault: false } });
      }
      return tx.taxRate.update({ where: { id }, data });
    });
  },

  async deleteTaxRate(hotelId: string, id: string) {
    const existing = await prisma.taxRate.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Tax rate not found");
    await prisma.taxRate.update({ where: { id }, data: { isActive: false } });
    return { id };
  },
};
