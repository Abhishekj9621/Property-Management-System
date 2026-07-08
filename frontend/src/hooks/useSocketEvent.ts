import { useEffect, useRef } from "react";
import { getSocket } from "../lib/socket";

/**
 * Subscribes to one or more Socket.IO events for the lifetime of the
 * component and cleans up on unmount. Keeps the latest `handler` in a ref so
 * callers can pass an inline arrow function without re-subscribing on every
 * render (which would otherwise cause listener churn).
 */
export function useSocketEvent<T = any>(event: string, handler: (payload: T) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(event, listener);

    return () => {
      socket.off(event, listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
}
