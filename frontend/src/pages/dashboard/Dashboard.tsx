import { useQuery } from "@tanstack/react-query";
import { BedDouble, TrendingUp, LogIn, LogOut, Percent } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { dashboardApi } from "../../api/dashboard.api";
import { StatCard } from "../../components/common/StatCard";
import { Money } from "../../components/common/Money";
import type { DashboardOverview } from "../../types";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";

export default function Dashboard() {
  // Bookings, check-ins/outs, room status, and payments all move the KPIs
  // on this page — refresh live instead of waiting for a manual reload.
  useRealtimeSync(
    [
      "booking:created",
      "booking:updated",
      "booking:checked-in",
      "booking:checked-out",
      "booking:deleted",
      "room:status-changed",
      "payment:recorded",
    ],
    ["dashboard-overview", "dashboard-upcoming"]
  );

  const { data, isLoading } = useQuery<DashboardOverview>({
    queryKey: ["dashboard-overview"],
    queryFn: dashboardApi.overview,
  });

  const { data: upcoming } = useQuery({
    queryKey: ["dashboard-upcoming"],
    queryFn: dashboardApi.upcoming,
  });

  if (isLoading || !data) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Loading dashboard…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Live overview of your property performance</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Occupancy Rate" value={`${data.occupancyRate}%`} icon={Percent} />
        <StatCard label="Occupied Rooms" value={`${data.occupiedRooms}/${data.totalRooms}`} icon={BedDouble} />
        <StatCard label="ADR" value={<Money amount={data.adr} />} icon={TrendingUp} />
        <StatCard label="Arrivals Today" value={data.arrivalsToday} icon={LogIn} />
        <StatCard label="Departures Today" value={data.departuresToday} icon={LogOut} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Revenue — Last 7 Days</h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.revenueTrend}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#rev)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Room Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.roomStatusBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="status" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingList title="Upcoming Arrivals" items={upcoming?.arrivals ?? []} dateKey="checkInDate" />
        <UpcomingList title="Upcoming Departures" items={upcoming?.departures ?? []} dateKey="checkOutDate" />
      </div>
    </div>
  );
}

function UpcomingList({ title, items, dateKey }: { title: string; items: any[]; dateKey: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing scheduled in the next 7 days.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.slice(0, 6).map((b) => (
            <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <p className="font-medium text-gray-900">
                  {b.guest.firstName} {b.guest.lastName}
                </p>
                <p className="text-xs text-gray-500">
                  Room {b.rooms.map((r: any) => r.room.roomNumber).join(", ")}
                </p>
              </div>
              <span className="text-xs text-gray-500">{new Date(b[dateKey]).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
