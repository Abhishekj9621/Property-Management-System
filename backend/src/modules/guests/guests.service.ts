import { prisma } from "../../config/database";
import { ApiError } from "../../utils/ApiError";

export const guestsService = {
  async create(hotelId: string, data: any) {
    return prisma.guest.create({ data: { ...data, hotelId } });
  },

  async list(hotelId: string, search?: string) {
    return prisma.guest.findMany({
      where: {
        hotelId,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      // Safety cap: this endpoint has no pagination UI yet, so without a
      // limit a large property's guest table would return an unbounded
      // payload on every page load. Narrow with `search` for anything
      // beyond this; a paginated endpoint is the follow-up if that's not
      // enough for very large guest lists.
      take: 500,
    });
  },

  async get(hotelId: string, id: string) {
    const guest = await prisma.guest.findFirst({
      where: { id, hotelId },
      include: {
        bookings: {
          orderBy: { createdAt: "desc" },
          include: { rooms: { include: { room: true, roomType: true } } },
        },
      },
    });
    if (!guest) throw ApiError.notFound("Guest not found");
    return guest;
  },

  async update(hotelId: string, id: string, data: any) {
    const guest = await prisma.guest.findFirst({ where: { id, hotelId } });
    if (!guest) throw ApiError.notFound("Guest not found");
    return prisma.guest.update({ where: { id }, data });
  },

  async delete(hotelId: string, id: string) {
    const guest = await prisma.guest.findFirst({
      where: { id, hotelId },
      include: { _count: { select: { bookings: true } } },
    });
    if (!guest) throw ApiError.notFound("Guest not found");
    if (guest._count.bookings > 0) {
      throw ApiError.conflict(
        "This guest has booking history and can't be deleted. Cancel or complete their bookings first."
      );
    }
    await prisma.guest.delete({ where: { id } });
    return { id };
  },
};
