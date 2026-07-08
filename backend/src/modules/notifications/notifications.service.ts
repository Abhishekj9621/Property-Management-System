import { prisma } from "../../config/database";
import { ApiError } from "../../utils/ApiError";
import { NotificationChannel } from "@prisma/client";

export const notificationsService = {
  /**
   * Persists an in-app notification and returns it so the caller can push
   * it over Socket.IO to the target user in real time.
   */
  async create(params: {
    userId: string;
    hotelId?: string | null;
    title: string;
    message: string;
    type?: string;
    channel?: NotificationChannel;
    link?: string;
  }) {
    return prisma.notification.create({
      data: {
        userId: params.userId,
        hotelId: params.hotelId ?? null,
        title: params.title,
        message: params.message,
        type: params.type ?? "GENERAL",
        channel: params.channel ?? "PUSH",
        link: params.link,
      },
    });
  },

  /** Notify every active staff member of a hotel (used for new-booking alerts, etc). */
  async createForHotelStaff(hotelId: string, params: { title: string; message: string; type?: string; link?: string }) {
    const staff = await prisma.user.findMany({
      where: { hotelId, isActive: true, role: { in: ["HOTEL_ADMIN", "MANAGER", "RECEPTIONIST"] } },
      select: { id: true },
    });
    if (staff.length === 0) return [];
    return Promise.all(
      staff.map((s) =>
        prisma.notification.create({
          data: {
            userId: s.id,
            hotelId,
            title: params.title,
            message: params.message,
            type: params.type ?? "GENERAL",
            link: params.link,
          },
        })
      )
    );
  },

  async listForUser(userId: string, opts: { unreadOnly?: boolean; page?: number; limit?: number } = {}) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const where = { userId, ...(opts.unreadOnly ? { isRead: false } : {}) };
    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { items, total, page, limit, unreadCount, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async markRead(userId: string, id: string) {
    const notification = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw ApiError.notFound("Notification not found");
    return prisma.notification.update({ where: { id }, data: { isRead: true } });
  },

  async markAllRead(userId: string) {
    await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return { success: true };
  },

  async remove(userId: string, id: string) {
    const notification = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw ApiError.notFound("Notification not found");
    await prisma.notification.delete({ where: { id } });
    return { id };
  },
};
