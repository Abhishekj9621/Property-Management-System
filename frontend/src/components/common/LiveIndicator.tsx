import { useEffect, useState } from "react";
import { getSocket } from "../../lib/socket";
import { useAuthStore } from "../../store/authStore";

/** Shows a small "Live" pulse when the real-time socket is connected, so
 * staff can tell at a glance whether room/booking/housekeeping boards are
 * updating live or if the connection has dropped. */
export function LiveIndicator() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setConnected(false);
      return;
    }
    const socket = getSocket();
    if (!socket) return;

    setConnected(socket.connected);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [accessToken]);

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium" title={connected ? "Real-time updates connected" : "Real-time updates offline — reconnecting..."}>
      <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
      <span className={connected ? "text-emerald-600" : "text-gray-400"}>{connected ? "Live" : "Offline"}</span>
    </div>
  );
}
