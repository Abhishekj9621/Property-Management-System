import { useEffect } from "react";
import { getSocket, disconnectSocket } from "../lib/socket";
import { useAuthStore } from "../store/authStore";
import { useHotelStore } from "../store/hotelStore";

/**
 * Mounts once near the root of the authenticated app. Opens the shared
 * Socket.IO connection whenever a user is logged in and tears it down on
 * logout, so every real-time hook throughout the app can just assume a live
 * connection exists (or gracefully get `null` while logged out).
 *
 * Also keeps the server-side room membership in sync with whichever hotel
 * is currently selected (relevant for SUPER_ADMIN, who has no fixed hotel
 * in their JWT and must explicitly join/switch rooms via the hotel
 * switcher — hotel-pinned staff join automatically server-side and this is
 * a no-op for them).
 */
export function useRealtimeConnection() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const selectedHotelId = useHotelStore((s) => s.selectedHotelId);

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket();
      return;
    }

    const socket = getSocket();

    return () => {
      // Intentionally not disconnecting on every unmount/token-change —
      // only a real logout (accessToken becomes null, handled above) should
      // drop the connection. This effect just makes sure it's alive.
      void socket;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !selectedHotelId) return;
    const socket = getSocket();
    if (!socket) return;

    if (socket.connected) {
      socket.emit("hotel:join", selectedHotelId);
    } else {
      // First connect hasn't fired yet — join as soon as it does.
      socket.once("connect", () => socket.emit("hotel:join", selectedHotelId));
    }
  }, [accessToken, selectedHotelId]);
}
