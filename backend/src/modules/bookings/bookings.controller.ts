import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { bookingsService } from "./bookings.service";
import { requireHotelId } from "../../utils/requestHotel";
import { sendMail, emailTemplates } from "../../utils/mailer";
import { notificationsService } from "../notifications/notifications.service";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtMoney(amount: number) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `₹${amount.toFixed(2)}`;
  }
}

async function notifyStaffAndPush(req: Request, hotelId: string, title: string, message: string, type: string, link?: string) {
  const notifications = await notificationsService.createForHotelStaff(hotelId, { title, message, type, link });
  const io = req.app.get("io");
  if (io) {
    for (const n of notifications) {
      io.to(`hotel:${hotelId}`).emit("notification:new", n);
    }
  }
}

export const bookingsController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const booking: any = await bookingsService.createBooking(requireHotelId(req), req.user?.id, req.body);
    const io = req.app.get("io");
    io?.to(`hotel:${booking.hotelId}`).emit("booking:created", booking);

    if (booking.guest?.email) {
      const tpl = emailTemplates.bookingConfirmed({
        guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
        hotelName: booking.hotel?.name ?? "your hotel",
        bookingRef: booking.bookingRef,
        checkIn: fmtDate(booking.checkInDate),
        checkOut: fmtDate(booking.checkOutDate),
        total: fmtMoney(Number(booking.totalAmount)),
      });
      sendMail({ to: booking.guest.email, ...tpl });
    }
    await notifyStaffAndPush(
      req,
      booking.hotelId,
      "New booking received",
      `${booking.guest?.firstName ?? "A guest"} booked ${booking.bookingRef} for ${fmtDate(booking.checkInDate)}`,
      "BOOKING",
      `/bookings/${booking.id}`
    );

    res.status(201).json(new ApiResponse("Booking created", booking));
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const { status, from, to, page, limit } = req.query;
    const result = await bookingsService.listBookings(requireHotelId(req), {
      status: status as any,
      from: from as string,
      to: to as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json(new ApiResponse("Bookings fetched", result.items, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    }));
  }),

  get: catchAsync(async (req: Request, res: Response) => {
    const booking = await bookingsService.getBooking(requireHotelId(req), req.params.id);
    res.status(200).json(new ApiResponse("Booking fetched", booking));
  }),

  updateStatus: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const booking: any = await bookingsService.updateStatus(
      hotelId,
      req.params.id,
      req.body.status,
      req.body.cancellationReason,
      req.user?.id
    );
    const io = req.app.get("io");
    io?.to(`hotel:${hotelId}`).emit("booking:updated", booking);

    if ((req.body.status === "CANCELLED" || req.body.status === "NO_SHOW") && booking.guest?.email) {
      const tpl = emailTemplates.bookingCancelled({
        guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
        hotelName: booking.hotel?.name ?? "your hotel",
        bookingRef: booking.bookingRef,
        reason: req.body.cancellationReason,
      });
      sendMail({ to: booking.guest.email, ...tpl });
    }

    res.status(200).json(new ApiResponse(`Booking status updated to ${req.body.status}`, booking));
  }),

  checkIn: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const booking = await bookingsService.checkIn(hotelId, req.params.id, req.user?.id);
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("booking:checked-in", booking);
    res.status(200).json(new ApiResponse("Guest checked in", booking));
  }),

  checkOut: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const booking: any = await bookingsService.checkOut(hotelId, req.params.id, req.user?.id);
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("booking:checked-out", booking);

    if (booking.guest?.email) {
      const tpl = emailTemplates.checkedOut({
        guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
        hotelName: booking.hotel?.name ?? "your hotel",
        bookingRef: booking.bookingRef,
        total: fmtMoney(Number(booking.totalAmount)),
        loyaltyPoints: booking.loyaltyPointsEarned ?? 0,
      });
      sendMail({ to: booking.guest.email, ...tpl });
    }

    res.status(200).json(new ApiResponse("Guest checked out", booking));
  }),

  amend: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const booking: any = await bookingsService.amendBooking(hotelId, req.params.id, req.body, req.user?.id);
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("booking:updated", booking);
    res.status(200).json(new ApiResponse("Booking amended", booking));
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    const hotelId = requireHotelId(req);
    const result = await bookingsService.deleteBooking(hotelId, req.params.id, req.user?.id);
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("booking:deleted", result);
    res.status(200).json(new ApiResponse("Booking deleted", result));
  }),
};
