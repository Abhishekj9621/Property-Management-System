import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { notificationsApi, AppNotification } from "../../api/notifications.api";
import { useSocketEvent } from "../../hooks/useSocketEvent";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Real-time notification bell: loads recent notifications on mount, then
 * appends new ones pushed live over Socket.IO as "notification:new" events
 * (fired by the backend on new bookings, payments, and housekeeping alerts).
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    notificationsApi.list({ limit: 15 }).then((res) => {
      setItems(res.items);
      setUnreadCount(res.unreadCount);
    }).catch(() => {});
  }, []);

  useSocketEvent<AppNotification>("notification:new", (n) => {
    setItems((prev) => [n, ...prev].slice(0, 20));
    setUnreadCount((c) => c + 1);
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleOpen() {
    setOpen((o) => !o);
    if (!open && unreadCount > 0) {
      await notificationsApi.markAllRead();
      setUnreadCount(0);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">Notifications</div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No notifications yet</div>
            ) : (
              items.map((n) => (
                <div key={n.id} className={`border-b border-gray-50 px-4 py-3 text-sm ${n.isRead ? "" : "bg-blue-50/50"}`}>
                  <div className="font-medium text-gray-800">{n.title}</div>
                  <div className="mt-0.5 text-gray-500">{n.message}</div>
                  <div className="mt-1 text-xs text-gray-400">{timeAgo(n.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
