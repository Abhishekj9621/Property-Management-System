import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { logger } from "../config/logger";
import { verifyAccessToken } from "../utils/jwt";
import { env } from "../config/env";

/**
 * Sets up Socket.IO for realtime front-of-house updates: live room-status
 * board, new bookings, check-in/out, and housekeeping task changes.
 * Clients join a `hotel:{hotelId}` room so events are scoped per property.
 */
export function initSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const payload = verifyAccessToken(token);
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const user = (socket as any).user;
    logger.info(`Socket connected: user=${user?.sub} role=${user?.role}`);

    // Hotel-pinned staff (everyone except SUPER_ADMIN) always auto-join
    // their own hotel's room — this is derived from the signed JWT, not
    // anything the client sends, so it can't be spoofed.
    if (user?.hotelId) socket.join(`hotel:${user.hotelId}`);

    // Multi-property staff (SUPER_ADMIN) have no fixed hotel, so the client
    // tells us which one it's currently viewing (via the same hotel
    // switcher that sets the x-hotel-id header for REST calls) and we join
    // that room — re-emitted whenever they switch hotels in the UI. Track
    // the current "switchable" room on the socket so switching leaves the
    // previous one instead of silently accumulating memberships in every
    // hotel ever viewed this session.
    let currentSwitchableRoom: string | null = null;
    socket.on("hotel:join", (hotelId: unknown) => {
      if (typeof hotelId !== "string" || !hotelId) return;

      // Hotel-pinned users can't switch away from their own hotel, even if
      // asked to — same tenant-isolation property as requireHotelId on the
      // REST side.
      const targetHotelId = user?.hotelId ?? hotelId;

      if (currentSwitchableRoom && currentSwitchableRoom !== `hotel:${targetHotelId}`) {
        socket.leave(currentSwitchableRoom);
      }
      const room = `hotel:${targetHotelId}`;
      socket.join(room);
      if (!user?.hotelId) currentSwitchableRoom = room;
    });

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: user=${user?.sub}`);
    });
  });

  return io;
}
