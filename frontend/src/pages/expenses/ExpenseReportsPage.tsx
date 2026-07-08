import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, TrendingUp, Clock, Wallet } from "lucide-react";
import { expenseReportsApi } from "../../api/expenseReports.api";
import { StatCard } from "../../components/common/StatCard";
import { Money } from "../../components/common/Money";

type Tab = "by-category" | "by-vendor" | "trend";

function firstOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseReportsPage() {
  const [tab, setTab] = useState<Tab>("by-category");
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());

  const { data: summary } = useQuery({ queryKey: ["expense-summary", from, to], queryFn: () => expenseReportsApi.summary({ from, to }) });
  const { data: byCategory, isLoading: catLoading } = useQuery({ queryKey: ["expense-by-category", from, to], queryFn: () => expenseReportsApi.byCategory({ from, to }), enabled: tab === "by-category" });
  const { data: byVendor, isLoading: vendorLoading } = useQuery({ queryKey: ["expense-by-vendor", from, to], queryFn: () => expenseReportsApi.byVendor({ from, to }), enabled: tab === "by-vendor" });
  const { data: trend, isLoading: trendLoading } = useQuery({ queryKey: ["expense-trend"], queryFn: () => expenseReportsApi.monthlyTrend(6), enabled: tab === "trend" });

  const maxTrend = trend ? Math.max(...trend.map((t: any) => t.total), 1) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Expense Reports</h1>
        <p className="text-sm text-gray-500">Spend breakdowns, vendor totals, and monthly trend</p>
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Spend" value={<Money amount={summary.totalSpend} />} icon={TrendingUp} />
          <StatCard label="Pending Approval" value={<Money amount={summary.pendingApproval} />} icon={Clock} />
          <StatCard label="Awaiting Reimbursement" value={<Money amount={summary.awaitingReimbursement} />} icon={Wallet} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {[
          { key: "by-category", label: "By Category" },
          { key: "by-vendor", label: "By Vendor" },
          { key: "trend", label: "Monthly Trend" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "by-category" || tab === "by-vendor") && (
        <div className="flex items-center gap-3">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
          <span className="text-sm text-gray-400">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
          <button
            onClick={() => expenseReportsApi.exportCsv(tab, `expenses-${tab}-${from}-to-${to}.csv`, { from, to })}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      )}

      {tab === "by-category" &&
        (catLoading ? (
          <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Category", "Total Spend", "Expense Count"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(byCategory ?? []).map((r: any) => (
                  <tr key={r.categoryId ?? "none"} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.categoryName}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <Money amount={r.total} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.count}</td>
                  </tr>
                ))}
                {(byCategory ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                      No spend recorded for this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "by-vendor" &&
        (vendorLoading ? (
          <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Vendor", "Total Spend", "Expense Count"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(byVendor ?? []).map((r: any) => (
                  <tr key={r.vendorId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.vendorName}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <Money amount={r.total} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.count}</td>
                  </tr>
                ))}
                {(byVendor ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                      No vendor spend recorded for this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "trend" &&
        (trendLoading ? (
          <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex h-48 items-end gap-3">
              {(trend ?? []).map((t: any) => (
                <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-brand-500" style={{ height: `${Math.max(4, (t.total / maxTrend) * 160)}px` }} title={`₹${t.total.toLocaleString()}`} />
                  <span className="text-xs text-gray-500">{t.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
