import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, X, Check, Ban, Banknote } from "lucide-react";
import { refundsApi } from "../../api/refunds.api";
import { Badge } from "../../components/common/Badge";
import { Money } from "../../components/common/Money";
import { useAuthStore } from "../../store/authStore";
import { can, FINANCE_MANAGERS } from "../../lib/permissions";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";
import type { Refund } from "../../types";

export default function RefundsPage() {
  useRealtimeSync(["refund:requested", "refund:approved", "refund:rejected", "refund:processed"], ["financial-refunds"]);

  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isManager = can(user?.role, FINANCE_MANAGERS);

  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ bookingId: "", paymentId: "", amount: "", reason: "", method: "CARD" });

  const { data, isLoading } = useQuery({
    queryKey: ["financial-refunds", statusFilter],
    queryFn: () => refundsApi.list(statusFilter ? { status: statusFilter } : undefined),
  });
  const refunds: Refund[] = data?.data ?? [];
  const summary: { status: string; total: number }[] = data?.meta?.summary ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      refundsApi.create({
        bookingId: form.bookingId,
        paymentId: form.paymentId || undefined,
        amount: Number(form.amount),
        reason: form.reason,
        method: form.method,
      }),
    onSuccess: () => {
      toast.success("Refund requested");
      queryClient.invalidateQueries({ queryKey: ["financial-refunds"] });
      setShowForm(false);
      setForm({ bookingId: "", paymentId: "", amount: "", reason: "", method: "CARD" });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not request refund"),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "APPROVED" | "REJECTED" }) => {
      const rejectionReason = status === "REJECTED" ? window.prompt("Reason for rejection?") ?? "Not specified" : undefined;
      return refundsApi.decide(id, { status, rejectionReason });
    },
    onSuccess: () => {
      toast.success("Refund updated");
      queryClient.invalidateQueries({ queryKey: ["financial-refunds"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Update failed"),
  });

  const processMutation = useMutation({
    mutationFn: (id: string) => {
      const transactionRef = window.prompt("Transaction reference (optional)") ?? undefined;
      return refundsApi.process(id, transactionRef);
    },
    onSuccess: () => {
      toast.success("Refund processed");
      queryClient.invalidateQueries({ queryKey: ["financial-refunds"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not process refund"),
  });

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading refunds…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Refunds</h1>
          <p className="text-sm text-gray-500">Request, approve, and process guest refunds</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus size={16} /> Request Refund
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["", "REQUESTED", "APPROVED", "REJECTED", "PROCESSED"].map((s) => (
          <button
            key={s || "ALL"}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusFilter === s ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {s || "All"} {summary.find((x) => x.status === s)?.total !== undefined && s ? `(${summary.find((x) => x.status === s)?.total})` : ""}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Booking", "Guest", "Amount", "Reason", "Status", "Requested", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {refunds.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No refunds found.
                </td>
              </tr>
            ) : (
              refunds.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.booking?.bookingRef ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-800">{r.booking ? `${r.booking.guest.firstName} ${r.booking.guest.lastName}` : "—"}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Money amount={Number(r.amount)} />
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-gray-600" title={r.reason}>
                    {r.reason}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {isManager && r.status === "REQUESTED" && (
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => decideMutation.mutate({ id: r.id, status: "APPROVED" })}
                          className="rounded-md bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100"
                          title="Approve"
                        >
                          <Check size={14} />
                        </button>
                        <button onClick={() => decideMutation.mutate({ id: r.id, status: "REJECTED" })} className="rounded-md bg-red-50 p-1.5 text-red-600 hover:bg-red-100" title="Reject">
                          <Ban size={14} />
                        </button>
                      </div>
                    )}
                    {isManager && r.status === "APPROVED" && (
                      <button
                        onClick={() => processMutation.mutate(r.id)}
                        className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        <Banknote size={14} /> Process
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Request Refund</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                placeholder="Booking ID"
                value={form.bookingId}
                onChange={(e) => setForm({ ...form, bookingId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Payment ID (optional)"
                value={form.paymentId}
                onChange={(e) => setForm({ ...form, paymentId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Amount"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="CARD">Card</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="WALLET">Wallet</option>
              </select>
              <textarea
                placeholder="Reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
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
                disabled={!form.bookingId || !form.amount || !form.reason || createMutation.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
