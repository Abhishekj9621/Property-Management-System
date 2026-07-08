import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, X, Check, Ban, Paperclip, Link as LinkIcon } from "lucide-react";
import { expensesApi } from "../../api/expenses.api";
import { vendorsApi } from "../../api/vendors.api";
import { useAuthStore } from "../../store/authStore";
import { can, EXPENSE_MANAGERS } from "../../lib/permissions";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";
import type { Expense, ExpenseCategory, Vendor } from "../../types";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-50 text-blue-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
  REIMBURSED: "bg-purple-50 text-purple-700",
  PAID: "bg-teal-50 text-teal-700",
};

function fmt(amount: number | string) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(amount));
  } catch {
    return `₹${amount}`;
  }
}

export default function ExpensesPage() {
  useRealtimeSync(["expense:created", "expense:updated", "expense:deleted"], ["expenses"]);

  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isManager = can(user?.role, EXPENSE_MANAGERS);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    vendor: "",
    vendorId: "",
    categoryId: "",
    isReimbursable: true,
    description: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => expensesApi.list(),
  });
  const expenses: Expense[] = data?.data ?? [];
  const summary: { status: string; total: number }[] = data?.meta?.summary ?? [];

  const { data: categories } = useQuery<ExpenseCategory[]>({
    queryKey: ["expense-categories"],
    queryFn: () => expensesApi.listCategories(),
  });
  const { data: vendors } = useQuery<Vendor[]>({ queryKey: ["vendors"], queryFn: () => vendorsApi.list() });

  const createMutation = useMutation({
    mutationFn: () =>
      expensesApi.create({
        title: form.title,
        amount: Number(form.amount),
        vendor: form.vendorId ? undefined : form.vendor || undefined,
        vendorId: form.vendorId || undefined,
        categoryId: form.categoryId || undefined,
        isReimbursable: form.isReimbursable,
        description: form.description || undefined,
      }),
    onSuccess: () => {
      toast.success("Expense submitted");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setShowForm(false);
      setForm({ title: "", amount: "", vendor: "", vendorId: "", categoryId: "", isReimbursable: true, description: "" });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not submit expense"),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => {
      const rejectionReason = status === "REJECTED" ? window.prompt("Reason for rejection?") ?? "Not specified" : undefined;
      let paymentMethod: string | undefined;
      let paymentReference: string | undefined;
      if (["REIMBURSED", "PAID"].includes(status)) {
        paymentMethod = window.prompt("Payment method? (CARD, CASH, BANK_TRANSFER, WALLET)", "BANK_TRANSFER") ?? undefined;
        paymentReference = window.prompt("Payment reference / transaction ID (optional)") ?? undefined;
      }
      return expensesApi.decide(id, { status, rejectionReason, paymentMethod, paymentReference });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense updated");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Update failed"),
  });

  const addAttachmentMutation = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) => expensesApi.addAttachment(id, { url }),
    onSuccess: (updated: Expense) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setSelected(updated);
      toast.success("Attachment added");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not add attachment"),
  });

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading expenses…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses & Claims</h1>
          <p className="text-sm text-gray-500">Operating expenses, vendor bills & staff reimbursement claims</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> New expense
        </button>
      </div>

      {isManager && summary.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {summary.map((s) => (
            <div key={s.status} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{s.status}</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{fmt(s.total)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Submitted by</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
              {isManager && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {expenses.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{e.title}</p>
                  {(e.vendorRecord?.name ?? e.vendor) && <p className="text-xs text-gray-400">{e.vendorRecord?.name ?? e.vendor}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">{e.category?.name ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{fmt(e.amount)}</td>
                <td className="px-4 py-3 text-gray-600">
                  {e.submittedBy ? `${e.submittedBy.firstName} ${e.submittedBy.lastName}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[e.status]}`}>{e.status}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setSelected(e)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600">
                    <Paperclip className="h-3.5 w-3.5" /> {e.attachments?.length ?? 0}
                  </button>
                </td>
                {isManager && (
                  <td className="px-4 py-3">
                    {e.status === "SUBMITTED" && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => decideMutation.mutate({ id: e.id, status: "APPROVED" })}
                          className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                        >
                          <Check className="h-3 w-3" /> Approve
                        </button>
                        <button
                          onClick={() => decideMutation.mutate({ id: e.id, status: "REJECTED" })}
                          className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          <Ban className="h-3 w-3" /> Reject
                        </button>
                      </div>
                    )}
                    {e.status === "APPROVED" && e.isReimbursable && (
                      <button
                        onClick={() => decideMutation.mutate({ id: e.id, status: "REIMBURSED" })}
                        className="rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100"
                      >
                        Mark reimbursed
                      </button>
                    )}
                    {e.status === "APPROVED" && !e.isReimbursable && (
                      <button
                        onClick={() => decideMutation.mutate({ id: e.id, status: "PAID" })}
                        className="rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100"
                      >
                        Mark paid
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={isManager ? 7 : 6} className="px-4 py-8 text-center text-gray-400">
                  No expenses recorded yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">New expense</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Amount (₹)</label>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Vendor</label>
                <select
                  value={form.vendorId}
                  onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                  className="mb-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">No vendor on file</option>
                  {vendors?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                {!form.vendorId && (
                  <input
                    placeholder="Or type a vendor name"
                    value={form.vendor}
                    onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Uncategorized</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                <input
                  type="checkbox"
                  checked={form.isReimbursable}
                  onChange={(e) => setForm({ ...form, isReimbursable: e.target.checked })}
                />
                This is a personal reimbursement claim
              </label>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {createMutation.isPending ? "Submitting…" : "Submit expense"}
              </button>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Attachments — {selected.title}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-2">
              {(selected.attachments ?? []).length === 0 && <p className="text-sm text-gray-400">No receipts attached yet.</p>}
              {selected.attachments?.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-brand-600 hover:bg-gray-50">
                  <LinkIcon className="h-3.5 w-3.5" /> {a.fileName ?? a.url}
                </a>
              ))}
            </div>
            <button
              onClick={() => {
                const url = window.prompt("Receipt URL");
                if (url) addAttachmentMutation.mutate({ id: selected.id, url });
              }}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              + Add receipt URL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
