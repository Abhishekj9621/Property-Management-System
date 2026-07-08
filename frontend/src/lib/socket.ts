import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../store/authStore";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

/**
 * Lazily creates (or returns) the single shared Socket.IO connection for the
 * app. Authenticates with the current access token, exactly like the axios
 * instance does for REST calls. Called once from useRealtimeConnection; every
 * other hook just subscribes to events on the shared instance.
 */
export function getSocket(): Socket | null {
  const token = useAuthStore.getState().accessToken;
  if (!token) return null;

  if (socket && socket.connected) return socket;

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  } else {
    // Token may have rotated (refresh flow) — update auth payload before reconnecting.
    socket.auth = { token };
  }

  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
