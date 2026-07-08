import { prisma } from "../../config/database";

function toCsv(rows: Record<string, any>[], columns: { key: string; header: string }[]): string {
  const escape = (val: any) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}

export const reportsService = {
  async bookingsCsv(hotelId: string, filters: { from?: string; to?: string } = {}) {
    const bookings = await prisma.booking.findMany({
      where: {
        hotelId,
        ...(filters.from || filters.to
          ? {
              checkInDate: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: { guest: true, rooms: { include: { room: true } } },
      orderBy: { checkInDate: "desc" },
    });

    const rows = bookings.map((b) => ({
      bookingRef: b.bookingRef,
      guest: `${b.guest.firstName} ${b.guest.lastName}`,
      email: b.guest.email,
      rooms: b.rooms.map((r) => r.room.roomNumber).join("; "),
      checkIn: b.checkInDate.toISOString().slice(0, 10),
      checkOut: b.checkOutDate.toISOString().slice(0, 10),
      status: b.status,
      adults: b.adults,
      children: b.children,
      totalAmount: Number(b.totalAmount).toFixed(2),
      paidAmount: Number(b.paidAmount).toFixed(2),
      source: b.source,
      createdAt: b.createdAt.toISOString(),
    }));

    return toCsv(rows, [
      { key: "bookingRef", header: "Booking Ref" },
      { key: "guest", header: "Guest" },
      { key: "email", header: "Email" },
      { key: "rooms", header: "Rooms" },
      { key: "checkIn", header: "Check-In" },
      { key: "checkOut", header: "Check-Out" },
      { key: "status", header: "Status" },
      { key: "adults", header: "Adults" },
      { key: "children", header: "Children" },
      { key: "totalAmount", header: "Total Amount" },
      { key: "paidAmount", header: "Paid Amount" },
      { key: "source", header: "Source" },
      { key: "createdAt", header: "Created At" },
    ]);
  },

  async revenueCsv(hotelId: string, filters: { from?: string; to?: string } = {}) {
    const payments = await prisma.payment.findMany({
      where: {
        status: "PAID",
        booking: { hotelId },
        ...(filters.from || filters.to
          ? {
              paidAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: { booking: { include: { guest: true } } },
      orderBy: { paidAt: "desc" },
    });

    const rows = payments.map((p) => ({
      date: p.paidAt ? p.paidAt.toISOString().slice(0, 10) : "",
      bookingRef: p.booking.bookingRef,
      guest: `${p.booking.guest.firstName} ${p.booking.guest.lastName}`,
      method: p.method,
      amount: Number(p.amount).toFixed(2),
      transactionRef: p.transactionRef ?? "",
    }));

    return toCsv(rows, [
      { key: "date", header: "Date" },
      { key: "bookingRef", header: "Booking Ref" },
      { key: "guest", header: "Guest" },
      { key: "method", header: "Method" },
      { key: "amount", header: "Amount" },
      { key: "transactionRef", header: "Transaction Ref" },
    ]);
  },

  async occupancyCsv(hotelId: string, filters: { from?: string; to?: string } = {}) {
    const from = filters.from ? new Date(filters.from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const to = filters.to ? new Date(filters.to) : new Date();

    const rooms = await prisma.room.findMany({ where: { hotelId }, select: { id: true } });
    const totalRooms = rooms.length || 1;

    const days: { date: string; occupied: number; occupancyRate: string }[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const dayStart = new Date(cursor);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);

      const occupied = await prisma.bookingRoom.count({
        where: {
          room: { hotelId },
          booking: {
            status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
            checkInDate: { lte: dayEnd },
            checkOutDate: { gt: dayStart },
          },
        },
      });

      days.push({
        date: dayStart.toISOString().slice(0, 10),
        occupied,
        occupancyRate: ((occupied / totalRooms) * 100).toFixed(1),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return toCsv(days, [
      { key: "date", header: "Date" },
      { key: "occupied", header: "Rooms Occupied" },
      { key: "occupancyRate", header: "Occupancy Rate %" },
    ]);
  },
};
