import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, TrendingUp, TrendingDown, Receipt, Wallet, Building2 } from "lucide-react";
import { financialReportsApi } from "../../api/financialReports.api";
import { StatCard } from "../../components/common/StatCard";
import { Money } from "../../components/common/Money";
import { useAuthStore } from "../../store/authStore";
import { can, FINANCE_CONSOLIDATED_VIEWERS } from "../../lib/permissions";

type Tab = "pnl" | "ar-aging" | "daily-cash" | "consolidated";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function FinancialReportsPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = can(user?.role, FINANCE_CONSOLIDATED_VIEWERS);

  const [tab, setTab] = useState<Tab>("pnl");
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [cashDate, setCashDate] = useState(todayIso());

  const { data: pnl, isLoading: pnlLoading } = useQuery({
    queryKey: ["report-pnl", from, to],
    queryFn: () => financialReportsApi.profitAndLoss({ from, to }),
    enabled: tab === "pnl",
  });

  const { data: arAging, isLoading: arLoading } = useQuery({
    queryKey: ["report-ar-aging"],
    queryFn: () => financialReportsApi.arAging(),
    enabled: tab === "ar-aging",
  });

  const { data: dailyCash, isLoading: cashLoading } = useQuery({
    queryKey: ["report-daily-cash", cashDate],
    queryFn: () => financialReportsApi.dailyCash(cashDate),
    enabled: tab === "daily-cash",
  });

  const { data: consolidated, isLoading: consolidatedLoading } = useQuery({
    queryKey: ["report-consolidated", from, to],
    queryFn: () => financialReportsApi.consolidated({ from, to }),
    enabled: tab === "consolidated" && isSuperAdmin,
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "pnl", label: "Profit & Loss" },
    { key: "ar-aging", label: "AR Aging" },
    { key: "daily-cash", label: "Daily Cash" },
    ...(isSuperAdmin ? [{ key: "consolidated" as Tab, label: "Consolidated (All Properties)" }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
        <p className="text-sm text-gray-500">Profit & loss, receivables aging, and cash position</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "pnl" || tab === "consolidated") && (
        <div className="flex items-center gap-3">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
          <span className="text-sm text-gray-400">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
          {tab === "pnl" && (
            <button
              onClick={() => financialReportsApi.exportCsv("profit-and-loss", `profit-and-loss-${from}-to-${to}.csv`, { from, to })}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      )}

      {tab === "pnl" &&
        (pnlLoading || !pnl ? (
          <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Revenue" value={<Money amount={pnl.revenue} />} icon={TrendingUp} />
            <StatCard label="Tax Collected" value={<Money amount={pnl.tax} />} icon={Receipt} />
            <StatCard label="Refunds" value={<Money amount={pnl.refunds} />} icon={TrendingDown} />
            <StatCard label="Expenses" value={<Money amount={pnl.expenses} />} icon={Wallet} />
            <StatCard label="Net Profit" value={<Money amount={pnl.netProfit} />} icon={TrendingUp} accent={pnl.netProfit >= 0 ? "brand" : "red"} />
          </div>
        ))}

      {tab === "ar-aging" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div />
            <button
              onClick={() => financialReportsApi.exportCsv("ar-aging", `ar-aging-${todayIso()}.csv`)}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
          {arLoading || !arAging ? (
            <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {Object.entries(arAging.buckets).map(([bucket, amount]) => (
                  <div key={bucket} className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                    <p className="text-xs font-medium text-gray-500">{bucket === "current" ? "Not yet due" : `${bucket} days`}</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">
                      <Money amount={amount as number} />
                    </p>
                  </div>
                ))}
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Invoice #", "Booking", "Guest", "Amount Due", "Age", "Bucket", "Due Date"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {arAging.rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                          No outstanding receivables. 🎉
                        </td>
                      </tr>
                    ) : (
                      arAging.rows.map((r: any) => (
                        <tr key={r.invoiceNumber} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.invoiceNumber}</td>
                          <td className="px-4 py-3 text-gray-600">{r.bookingRef}</td>
                          <td className="px-4 py-3 text-gray-800">{r.guest}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <Money amount={r.amountDue} />
                          </td>
                          <td className="px-4 py-3 text-gray-600">{r.ageDays}d</td>
                          <td className="px-4 py-3 text-gray-600">{r.bucket}</td>
                          <td className="px-4 py-3 text-gray-600">{r.dueDate}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "daily-cash" && (
        <div className="space-y-4">
          <input type="date" value={cashDate} onChange={(e) => setCashDate(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
          {cashLoading || !dailyCash ? (
            <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <StatCard label="Cash In" value={<Money amount={dailyCash.cashIn} />} icon={TrendingUp} />
                <StatCard label="Refunds Paid Out" value={<Money amount={dailyCash.cashOutRefunds} />} icon={TrendingDown} />
                <StatCard label="Expenses Paid Out" value={<Money amount={dailyCash.cashOutExpenses} />} icon={Wallet} />
                <StatCard label="Net Cash" value={<Money amount={dailyCash.netCash} />} icon={TrendingUp} />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-gray-700">Cash In by Method</h2>
                {Object.keys(dailyCash.byMethod).length === 0 ? (
                  <p className="text-sm text-gray-400">No payments recorded for this date.</p>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(dailyCash.byMethod).map(([method, amount]) => (
                      <div key={method} className="flex justify-between text-sm">
                        <span className="text-gray-600">{method.replace(/_/g, " ")}</span>
                        <span className="font-medium text-gray-900">
                          <Money amount={amount as number} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "consolidated" && isSuperAdmin && (
        <div className="space-y-4">
          {consolidatedLoading || !consolidated ? (
            <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Total Revenue" value={<Money amount={consolidated.totals.revenue} />} icon={TrendingUp} />
                <StatCard label="Total Tax" value={<Money amount={consolidated.totals.tax} />} icon={Receipt} />
                <StatCard label="Total Refunds" value={<Money amount={consolidated.totals.refunds} />} icon={TrendingDown} />
                <StatCard label="Total Expenses" value={<Money amount={consolidated.totals.expenses} />} icon={Wallet} />
                <StatCard label="Net Profit" value={<Money amount={consolidated.totals.netProfit} />} icon={Building2} />
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Property", "City", "Revenue", "Tax", "Refunds", "Expenses", "Net Profit"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {consolidated.hotels.map((h: any) => (
                      <tr key={h.hotelId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{h.hotelName}</td>
                        <td className="px-4 py-3 text-gray-600">{h.city}</td>
                        <td className="px-4 py-3 text-gray-700">
                          <Money amount={h.revenue} />
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <Money amount={h.tax} />
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <Money amount={h.refunds} />
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <Money amount={h.expenses} />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <Money amount={h.netProfit} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
