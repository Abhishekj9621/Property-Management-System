import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee, TrendingUp, Percent, BedDouble, Download } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { dashboardApi } from "../../api/dashboard.api";
import { paymentsApi } from "../../api/payments.api";
import { api } from "../../api/axios";
import { StatCard } from "../../components/common/StatCard";
import { Money } from "../../components/common/Money";
import type { DashboardOverview, Payment } from "../../types";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";

const METHOD_COLORS: Record<string, string> = {
  CARD: "#2563eb",
  CASH: "#16a34a",
  BANK_TRANSFER: "#9333ea",
  WALLET: "#f59e0b",
};

const formatMoney = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

export default function RevenuePage() {
  useRealtimeSync(["payment:recorded", "booking:checked-out"], ["dashboard-overview", "payments"]);

  const [page, setPage] = useState(1);

  const { data: overview, isLoading: overviewLoading } = useQuery<DashboardOverview>({
    queryKey: ["dashboard-overview"],
    queryFn: dashboardApi.overview,
  });

  const { data: paymentsResult, isLoading: paymentsLoading } = useQuery({
    queryKey: ["payments", page],
    queryFn: () => paymentsApi.listForHotel({ page, limit: 10 }),
  });

  const payments: Payment[] = paymentsResult?.items ?? [];
  const summary = paymentsResult?.meta?.summary as { totalRevenue: number; byMethod: Record<string, number> } | undefined;
  const totalPages = (paymentsResult?.meta?.totalPages as number) ?? 1;

  const methodBreakdown = summary
    ? Object.entries(summary.byMethod).map(([method, amount]) => ({ method, amount }))
    : [];

  async function exportCsv(endpoint: "revenue" | "bookings" | "occupancy") {
    const res = await api.get(`/reports/${endpoint}.csv`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${endpoint}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  if (overviewLoading || !overview) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Loading revenue…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
          <p className="text-sm text-gray-500">Payments, rates, and performance for this property</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportCsv("revenue")}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <Download size={14} /> Export Revenue
          </button>
          <button
            onClick={() => exportCsv("bookings")}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <Download size={14} /> Export Bookings
          </button>
          <button
            onClick={() => exportCsv("occupancy")}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <Download size={14} /> Export Occupancy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Collected" value={<Money amount={summary?.totalRevenue ?? 0} />} icon={IndianRupee} />
        <StatCard label="ADR (Avg. Daily Rate)" value={<Money amount={overview.adr} />} icon={TrendingUp} />
        <StatCard label="RevPAR" value={<Money amount={overview.revPar} />} icon={BedDouble} />
        <StatCard label="Occupancy Rate" value={`${overview.occupancyRate}%`} icon={Percent} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Revenue Trend — Last 7 Days</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={overview.revenueTrend}>
              <defs>
                <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#rev2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">By Payment Method</h2>
          {methodBreakdown.length === 0 ? (
            <p className="flex h-52 items-center justify-center text-sm text-gray-400">No payments yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={methodBreakdown} dataKey="amount" nameKey="method" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {methodBreakdown.map((entry) => (
                    <Cell key={entry.method} fill={METHOD_COLORS[entry.method] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatMoney(value)} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 space-y-1">
            {methodBreakdown.map((entry) => (
              <div key={entry.method} className="flex items-center justify-between text-xs text-gray-600">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: METHOD_COLORS[entry.method] ?? "#94a3b8" }}
                  />
                  {entry.method.replace(/_/g, " ")}
                </span>
                <span className="font-medium text-gray-800">{formatMoney(entry.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Recent Transactions</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Booking Ref", "Guest", "Method", "Amount", "Paid At"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paymentsLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Loading transactions…
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No transactions found.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.booking?.bookingRef ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-800">
                    {p.booking ? `${p.booking.guest.firstName} ${p.booking.guest.lastName}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.method.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 font-medium text-gray-900"><Money amount={Number(p.amount)} /></td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.paidAt ? new Date(p.paidAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-gray-200 px-2.5 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-gray-200 px-2.5 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
