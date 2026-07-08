import { prisma } from "../../config/database";
import { ApiError } from "../../utils/ApiError";
import { Prisma } from "@prisma/client";

const includeGraph = {
  asset: true,
  assignee: { select: { id: true, firstName: true, lastName: true, role: true } },
  reportedBy: { select: { id: true, firstName: true, lastName: true } },
};

export const maintenanceService = {
  async createRequest(hotelId: string, reportedById: string | undefined, data: any) {
    if (data.assetId) {
      const asset = await prisma.asset.findFirst({ where: { id: data.assetId, hotelId } });
      if (!asset) throw ApiError.badRequest("Asset not found for this hotel");
    }
    if (data.roomId) {
      const room = await prisma.room.findFirst({ where: { id: data.roomId, hotelId } });
      if (!room) throw ApiError.badRequest("Room not found for this hotel");
    }
    if (data.assigneeId) {
      const assignee = await prisma.user.findFirst({ where: { id: data.assigneeId, hotelId } });
      if (!assignee) throw ApiError.badRequest("Assignee not found for this hotel");
    }

    return prisma.maintenanceRequest.create({
      data: { ...data, hotelId, reportedById },
      include: includeGraph,
    });
  },

  async listRequests(
    hotelId: string,
    filters: { status?: string; priority?: string; assigneeId?: string; assetId?: string; page?: number; limit?: number }
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const where: Prisma.MaintenanceRequestWhereInput = {
      hotelId,
      ...(filters.status ? { status: filters.status as any } : {}),
      ...(filters.priority ? { priority: filters.priority as any } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.assetId ? { assetId: filters.assetId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where,
        include: includeGraph,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.maintenanceRequest.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getRequest(hotelId: string, id: string) {
    const request = await prisma.maintenanceRequest.findFirst({ where: { id, hotelId }, include: includeGraph });
    if (!request) throw ApiError.notFound("Maintenance request not found");
    return request;
  },

  async updateRequest(hotelId: string, id: string, data: any) {
    const existing = await prisma.maintenanceRequest.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Maintenance request not found");

    if (data.assigneeId) {
      const assignee = await prisma.user.findFirst({ where: { id: data.assigneeId, hotelId } });
      if (!assignee) throw ApiError.badRequest("Assignee not found for this hotel");
    }

    const updateData: any = { ...data };
    if (data.status === "IN_PROGRESS" && !existing.startedAt) updateData.startedAt = new Date();
    if (data.status === "COMPLETED") updateData.completedAt = new Date();

    // Request status and the asset status it drives must move together —
    // if the process died between the two writes, the asset could be left
    // stuck "under maintenance" after the request was actually completed.
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.maintenanceRequest.update({ where: { id }, data: updateData, include: includeGraph });

      // If tied to an asset and being worked on, reflect that on the asset's
      // status. `updated.asset` was fetched before this update runs, so we
      // overwrite it with the fresh value — otherwise the returned request
      // (and the real-time event built from it) would carry the asset's
      // stale pre-update status.
      if (updated.assetId) {
        if (data.status === "IN_PROGRESS") {
          updated.asset = await tx.asset.update({ where: { id: updated.assetId }, data: { status: "UNDER_MAINTENANCE" } });
        } else if (data.status === "COMPLETED") {
          updated.asset = await tx.asset.update({ where: { id: updated.assetId }, data: { status: "IN_SERVICE" } });
        }
      }

      return updated;
    });
  },

  async deleteRequest(hotelId: string, id: string) {
    const existing = await prisma.maintenanceRequest.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Maintenance request not found");
    await prisma.maintenanceRequest.delete({ where: { id } });
    return { id };
  },

  // --- Assets ---

  async createAsset(hotelId: string, data: any) {
    return prisma.asset.create({ data: { ...data, hotelId } });
  },

  async listAssets(hotelId: string, filters: { status?: string; category?: string }) {
    return prisma.asset.findMany({
      where: {
        hotelId,
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.category ? { category: filters.category } : {}),
      },
      orderBy: { createdAt: "desc" },
      // Safety cap — see listTasks in housekeeping.service.ts for the same
      // reasoning; this endpoint has no pagination UI yet.
      take: 500,
    });
  },

  async getAsset(hotelId: string, id: string) {
    const asset = await prisma.asset.findFirst({
      where: { id, hotelId },
      include: { maintenanceRequests: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    if (!asset) throw ApiError.notFound("Asset not found");
    return asset;
  },

  async updateAsset(hotelId: string, id: string, data: any) {
    const existing = await prisma.asset.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Asset not found");
    return prisma.asset.update({ where: { id }, data });
  },

  async deleteAsset(hotelId: string, id: string) {
    const existing = await prisma.asset.findFirst({ where: { id, hotelId } });
    if (!existing) throw ApiError.notFound("Asset not found");
    const openRequests = await prisma.maintenanceRequest.count({
      where: { assetId: id, status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] } },
    });
    if (openRequests > 0) throw ApiError.conflict("Asset has open maintenance requests and can't be deleted");
    await prisma.asset.delete({ where: { id } });
    return { id };
  },
};
