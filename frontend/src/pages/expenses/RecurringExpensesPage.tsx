import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, X, Pause, Play, Trash2 } from "lucide-react";
import { recurringExpensesApi } from "../../api/recurringExpenses.api";
import { expensesApi } from "../../api/expenses.api";
import { vendorsApi } from "../../api/vendors.api";
import { Money } from "../../components/common/Money";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";
import type { RecurringExpense, ExpenseCategory, Vendor } from "../../types";

export default function RecurringExpensesPage() {
  useRealtimeSync(["recurring-expense:created", "recurring-expense:updated", "recurring-expense:deleted"], ["recurring-expenses"]);

  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    categoryId: "",
    vendorId: "",
    frequency: "MONTHLY",
    startDate: new Date().toISOString().slice(0, 10),
    isReimbursable: false,
  });

  const { data: items, isLoading } = useQuery<RecurringExpense[]>({ queryKey: ["recurring-expenses", "all"], queryFn: () => recurringExpensesApi.list(true) });
  const { data: categories } = useQuery<ExpenseCategory[]>({ queryKey: ["expense-categories"], queryFn: () => expensesApi.listCategories() });
  const { data: vendors } = useQuery<Vendor[]>({ queryKey: ["vendors"], queryFn: () => vendorsApi.list() });

  const createMutation = useMutation({
    mutationFn: () =>
      recurringExpensesApi.create({
        title: form.title,
        amount: Number(form.amount),
        categoryId: form.categoryId || undefined,
        vendorId: form.vendorId || undefined,
        frequency: form.frequency,
        startDate: new Date(form.startDate).toISOString(),
        isReimbursable: form.isReimbursable,
      }),
    onSuccess: () => {
      toast.success("Recurring expense created");
      queryClient.invalidateQueries({ queryKey: ["recurring-expenses"] });
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not create recurring expense"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => (active ? recurringExpensesApi.resume(id) : recurringExpensesApi.pause(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-expenses"] });
      toast.success("Updated");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => recurringExpensesApi.remove(id),
    onSuccess: () => {
      toast.success("Recurring expense deleted");
      queryClient.invalidateQueries({ queryKey: ["recurring-expenses"] });
    },
  });

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading recurring expenses…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recurring Expenses</h1>
          <p className="text-sm text-gray-500">Templates that auto-generate claims on schedule — rent, subscriptions, contracts</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus size={16} /> New Template
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Title", "Amount", "Frequency", "Next Run", "Vendor", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(items ?? []).map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
                <td className="px-4 py-3 text-gray-700">
                  <Money amount={Number(r.amount)} />
                </td>
                <td className="px-4 py-3 text-gray-600">{r.frequency}</td>
                <td className="px-4 py-3 text-gray-600">{new Date(r.nextRunDate).toISOString().slice(0, 10)}</td>
                <td className="px-4 py-3 text-gray-600">{r.vendor?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {r.isActive ? "Active" : "Paused"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => toggleMutation.mutate({ id: r.id, active: !r.isActive })} className="text-gray-400 hover:text-brand-600" title={r.isActive ? "Pause" : "Resume"}>
                      {r.isActive ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button onClick={() => removeMutation.mutate(r.id)} className="text-gray-400 hover:text-red-500" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(items ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No recurring expenses set up yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">New Recurring Expense</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <input placeholder="Title (e.g. Office Rent)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Uncategorized</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">No vendor</option>
                {vendors?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </select>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">First run date</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                <input type="checkbox" checked={form.isReimbursable} onChange={(e) => setForm({ ...form, isReimbursable: e.target.checked })} />
                Generated claims are personal reimbursements
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.title || !form.amount || createMutation.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
