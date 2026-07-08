import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getSocket } from "../lib/socket";

/**
 * Subscribes to a list of Socket.IO event names and invalidates the given
 * React Query key prefixes whenever any of them fire — e.g. another
 * receptionist checking a guest in updates everyone's room board and
 * booking list instantly, no refresh needed.
 */
export function useRealtimeSync(events: string[], queryKeyPrefixes: string[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = () => {
      queryKeyPrefixes.forEach((prefix) => {
        queryClient.invalidateQueries({ queryKey: [prefix] });
      });
    };

    events.forEach((event) => socket.on(event, handler));
    return () => {
      events.forEach((event) => socket.off(event, handler));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.join(","), queryKeyPrefixes.join(",")]);
}
