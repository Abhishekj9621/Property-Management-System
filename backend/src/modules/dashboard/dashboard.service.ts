import { prisma } from "../../config/database";

export const dashboardService = {
  /**
   * Aggregates the KPIs a hotel front-office/admin dashboard needs:
   * occupancy rate, ADR (Average Daily Rate), RevPAR (Revenue per Available Room),
   * today's arrivals/departures, and a 7-day revenue trend.
   */
  async getOverview(hotelId: string) {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const [totalRooms, occupiedRooms, arrivalsToday, departuresToday, activeBookings] = await Promise.all([
      prisma.room.count({ where: { hotelId } }),
      prisma.room.count({ where: { hotelId, status: "OCCUPIED" } }),
      prisma.booking.count({
        where: { hotelId, checkInDate: { gte: startOfToday, lte: endOfToday }, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      }),
      prisma.booking.count({
        where: { hotelId, checkOutDate: { gte: startOfToday, lte: endOfToday }, status: "CHECKED_IN" },
      }),
      prisma.booking.findMany({
        where: { hotelId, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
        select: { totalAmount: true, rooms: { select: { roomId: true } } },
      }),
    ]);

    const occupancyRate = totalRooms > 0 ? Number(((occupiedRooms / totalRooms) * 100).toFixed(1)) : 0;

    const totalRoomNights = activeBookings.reduce((sum, b) => sum + b.rooms.length, 0);
    const totalRevenue = activeBookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const adr = totalRoomNights > 0 ? Number((totalRevenue / totalRoomNights).toFixed(2)) : 0;
    const revPar = totalRooms > 0 ? Number((totalRevenue / totalRooms).toFixed(2)) : 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentBookings = await prisma.booking.findMany({
      where: { hotelId, createdAt: { gte: sevenDaysAgo }, status: { not: "CANCELLED" } },
      select: { createdAt: true, totalAmount: true },
    });

    const revenueTrend: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      revenueTrend[key] = 0;
    }
    recentBookings.forEach((b) => {
      const key = b.createdAt.toISOString().slice(0, 10);
      if (key in revenueTrend) revenueTrend[key] += Number(b.totalAmount);
    });

    const roomStatusBreakdown = await prisma.room.groupBy({
      by: ["status"],
      where: { hotelId },
      _count: true,
    });

    return {
      totalRooms,
      occupiedRooms,
      occupancyRate,
      adr,
      revPar,
      arrivalsToday,
      departuresToday,
      revenueTrend: Object.entries(revenueTrend).map(([date, revenue]) => ({ date, revenue })),
      roomStatusBreakdown: roomStatusBreakdown.map((r) => ({ status: r.status, count: r._count })),
    };
  },

  async getUpcoming(hotelId: string) {
    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(now.getDate() + 7);

    const [arrivals, departures] = await Promise.all([
      prisma.booking.findMany({
        where: { hotelId, checkInDate: { gte: now, lte: in7Days }, status: "CONFIRMED" },
        include: { guest: true, rooms: { include: { room: true } } },
        orderBy: { checkInDate: "asc" },
        take: 20,
      }),
      prisma.booking.findMany({
        where: { hotelId, checkOutDate: { gte: now, lte: in7Days }, status: "CHECKED_IN" },
        include: { guest: true, rooms: { include: { room: true } } },
        orderBy: { checkOutDate: "asc" },
        take: 20,
      }),
    ]);

    return { arrivals, departures };
  },
};
