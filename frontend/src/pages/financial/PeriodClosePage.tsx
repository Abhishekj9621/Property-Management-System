import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Lock, Unlock, Moon } from "lucide-react";
import { periodCloseApi } from "../../api/periodClose.api";
import { Money } from "../../components/common/Money";
import { StatCard } from "../../components/common/StatCard";
import { useAuthStore } from "../../store/authStore";
import { can, FINANCE_PERIOD_REOPENERS } from "../../lib/permissions";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";
import { TrendingUp, TrendingDown, Receipt, Wallet } from "lucide-react";
import type { FinancialPeriodClose } from "../../types";

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function PeriodClosePage() {
  useRealtimeSync(["period:closed", "period:reopened"], ["period-closes"]);

  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const canReopen = can(user?.role, FINANCE_PERIOD_REOPENERS);

  const [businessDate, setBusinessDate] = useState(yesterday());
  const [notes, setNotes] = useState("");

  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ["period-close-preview", businessDate],
    queryFn: () => periodCloseApi.preview(businessDate),
    enabled: !!businessDate,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["period-closes"],
    queryFn: () => periodCloseApi.list({ limit: 20 }),
  });
  const closes: FinancialPeriodClose[] = history?.data ?? [];

  const closeMutation = useMutation({
    mutationFn: () => periodCloseApi.close({ businessDate, notes: notes || undefined }),
    onSuccess: () => {
      toast.success(`Business day ${businessDate} closed`);
      queryClient.invalidateQueries({ queryKey: ["period-closes"] });
      queryClient.invalidateQueries({ queryKey: ["period-close-preview"] });
      setNotes("");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not close business day"),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => {
      const reason = window.prompt("Reason for reopening this period?");
      if (!reason) throw new Error("cancelled");
      return periodCloseApi.reopen(id, reason);
    },
    onSuccess: () => {
      toast.success("Period reopened");
      queryClient.invalidateQueries({ queryKey: ["period-closes"] });
    },
    onError: (err: any) => {
      if (err?.message === "cancelled") return;
      toast.error(err?.response?.data?.message ?? "Could not reopen period");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Day-End / Night Audit</h1>
        <p className="text-sm text-gray-500">Review and close the books for a business date</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <Moon className="h-5 w-5 text-brand-600" />
          <h2 className="text-sm font-semibold text-gray-700">Close a Business Day</h2>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>

        {previewLoading || !preview ? (
          <p className="text-sm text-gray-400">Computing preview…</p>
        ) : (
          <>
            {preview.alreadyClosed && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">This business date is already closed.</p>
            )}
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Revenue" value={<Money amount={preview.totalRevenue} />} icon={TrendingUp} />
              <StatCard label="Tax Collected" value={<Money amount={preview.totalTax} />} icon={Receipt} />
              <StatCard label="Refunds" value={<Money amount={preview.totalRefunds} />} icon={TrendingDown} />
              <StatCard label="Net Cash" value={<Money amount={preview.netCashPosition} />} icon={Wallet} />
            </div>
            <textarea
              placeholder="Notes for this close (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
            <button
              onClick={() => closeMutation.mutate()}
              disabled={preview.alreadyClosed || closeMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Lock size={16} /> {closeMutation.isPending ? "Closing…" : "Close Business Day"}
            </button>
          </>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Close History</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Business Date", "Status", "Revenue", "Refunds", "Expenses", "Net Cash", "Closed By", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {historyLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : closes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No closed periods yet.
                </td>
              </tr>
            ) : (
              closes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{new Date(c.businessDate).toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.status === "CLOSED" ? "bg-gray-200 text-gray-700" : "bg-blue-100 text-blue-700"}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <Money amount={Number(c.totalRevenue)} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <Money amount={Number(c.totalRefunds)} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <Money amount={Number(c.totalExpenses)} />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Money amount={Number(c.netCashPosition)} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.closedBy ? `${c.closedBy.firstName} ${c.closedBy.lastName}` : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {canReopen && c.status === "CLOSED" && (
                      <button
                        onClick={() => reopenMutation.mutate(c.id)}
                        className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                      >
                        <Unlock size={12} /> Reopen
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
