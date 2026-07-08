import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, X, BookOpen } from "lucide-react";
import { ledgerApi } from "../../api/ledger.api";
import { Money } from "../../components/common/Money";
import { StatCard } from "../../components/common/StatCard";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import type { LedgerEntry } from "../../types";

export default function LedgerPage() {
  useRealtimeSync(["ledger:entry-created"], ["ledger"]);

  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "ADJUSTMENT", direction: "DEBIT", amount: "", description: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["ledger", typeFilter],
    queryFn: () => ledgerApi.list(typeFilter ? { type: typeFilter, limit: 100 } : { limit: 100 }),
  });
  const entries: LedgerEntry[] = data?.data ?? [];
  const summary: { debit: number; credit: number; net: number } = data?.meta?.summary ?? { debit: 0, credit: 0, net: 0 };

  const createMutation = useMutation({
    mutationFn: () => ledgerApi.createManualEntry({ type: form.type, direction: form.direction, amount: Number(form.amount), description: form.description }),
    onSuccess: () => {
      toast.success("Ledger entry posted");
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      setShowForm(false);
      setForm({ type: "ADJUSTMENT", direction: "DEBIT", amount: "", description: "" });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not post entry"),
  });

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading ledger…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">General Ledger</h1>
          <p className="text-sm text-gray-500">Append-only financial audit trail for this property</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus size={16} /> Manual Entry
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Credits" value={<Money amount={summary.credit} />} icon={TrendingUp} />
        <StatCard label="Total Debits" value={<Money amount={summary.debit} />} icon={TrendingDown} />
        <StatCard label="Net Position" value={<Money amount={summary.net} />} icon={Scale} />
      </div>

      <div className="flex flex-wrap gap-2">
        {["", "REVENUE", "TAX", "DISCOUNT", "REFUND", "EXPENSE", "ADJUSTMENT"].map((t) => (
          <button
            key={t || "ALL"}
            onClick={() => setTypeFilter(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${typeFilter === t ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {t || "All"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Date", "Type", "Direction", "Description", "Source", "Amount"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No ledger entries found.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{new Date(e.entryDate).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-800">{e.type}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.direction === "CREDIT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{e.direction}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.description}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{e.sourceType}{e.referenceCode ? ` · ${e.referenceCode}` : ""}</td>
                  <td className={`px-4 py-3 text-right font-medium ${e.direction === "CREDIT" ? "text-green-700" : "text-red-700"}`}>
                    {e.direction === "CREDIT" ? "+" : "-"}
                    <Money amount={Number(e.amount)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-brand-600" />
                <h2 className="text-lg font-bold text-gray-900">Manual Ledger Entry</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {["REVENUE", "TAX", "DISCOUNT", "REFUND", "EXPENSE", "ADJUSTMENT"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </select>
              <input placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <textarea
                placeholder="Description (e.g. bank reconciliation write-off)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={2}
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.amount || !form.description || createMutation.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Posting…" : "Post Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
