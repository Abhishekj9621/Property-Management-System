import { prisma } from "../../config/database";
import { ApiError } from "../../utils/ApiError";

export const reviewsService = {
  async create(hotelId: string, input: { bookingId: string; rating: number; cleanliness?: number; service?: number; valueForMoney?: number; comment?: string }) {
    const booking = await prisma.booking.findFirst({
      where: { id: input.bookingId, hotelId },
      include: { guest: true, review: true },
    });
    if (!booking) throw ApiError.notFound("Booking not found");
    if (booking.status !== "CHECKED_OUT") throw ApiError.badRequest("Reviews can only be left after checkout");
    if (booking.review) throw ApiError.conflict("A review already exists for this booking");
    if (input.rating < 1 || input.rating > 5) throw ApiError.badRequest("Rating must be between 1 and 5");

    return prisma.review.create({
      data: {
        hotelId,
        bookingId: input.bookingId,
        guestId: booking.guestId,
        rating: input.rating,
        cleanliness: input.cleanliness,
        service: input.service,
        valueForMoney: input.valueForMoney,
        comment: input.comment,
      },
    });
  },

  async listForHotel(hotelId: string, opts: { page?: number; limit?: number } = {}) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const where = { hotelId, isPublished: true };
    const [items, total, aggregate] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { guest: true, booking: { select: { bookingRef: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({ where, _avg: { rating: true, cleanliness: true, service: true, valueForMoney: true } }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      averageRating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(2)) : null,
      averages: {
        cleanliness: aggregate._avg.cleanliness ? Number(aggregate._avg.cleanliness.toFixed(2)) : null,
        service: aggregate._avg.service ? Number(aggregate._avg.service.toFixed(2)) : null,
        valueForMoney: aggregate._avg.valueForMoney ? Number(aggregate._avg.valueForMoney.toFixed(2)) : null,
      },
    };
  },

  async respond(hotelId: string, id: string, response: string) {
    const review = await prisma.review.findFirst({ where: { id, hotelId } });
    if (!review) throw ApiError.notFound("Review not found");
    return prisma.review.update({ where: { id }, data: { response, respondedAt: new Date() } });
  },
};
