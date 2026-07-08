import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { LiveIndicator } from "../common/LiveIndicator";
import { NotificationBell } from "../common/NotificationBell";
import { useRealtimeConnection } from "../../hooks/useRealtimeConnection";

export function DashboardLayout() {
  useRealtimeConnection();

  return (
    <div className="flex">
      <Sidebar />
      <main className="h-screen flex-1 overflow-y-auto bg-gray-50 p-8">
        <div className="mb-6 flex items-center justify-end gap-4">
          <LiveIndicator />
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
