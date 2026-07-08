import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, X, Trash2 } from "lucide-react";
import { expenseBudgetsApi } from "../../api/expenseBudgets.api";
import { expensesApi } from "../../api/expenses.api";
import { Money } from "../../components/common/Money";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";
import type { ExpenseBudget, ExpenseCategory } from "../../types";

function progressColor(pct: number) {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

export default function ExpenseBudgetsPage() {
  useRealtimeSync(["expense-budget:created", "expense-budget:updated", "expense-budget:deleted"], ["expense-budgets"]);

  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ categoryId: "", year: String(now.getUTCFullYear()), month: String(now.getUTCMonth() + 1), amount: "", alertThresholdPercent: "90" });

  const { data: budgets, isLoading } = useQuery<ExpenseBudget[]>({ queryKey: ["expense-budgets", year], queryFn: () => expenseBudgetsApi.list({ year }) });
  const { data: categories } = useQuery<ExpenseCategory[]>({ queryKey: ["expense-categories"], queryFn: () => expensesApi.listCategories() });

  const createMutation = useMutation({
    mutationFn: () =>
      expenseBudgetsApi.create({
        categoryId: form.categoryId || undefined,
        year: Number(form.year),
        month: form.month ? Number(form.month) : undefined,
        amount: Number(form.amount),
        alertThresholdPercent: Number(form.alertThresholdPercent),
      }),
    onSuccess: () => {
      toast.success("Budget created");
      queryClient.invalidateQueries({ queryKey: ["expense-budgets"] });
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not create budget"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => expenseBudgetsApi.remove(id),
    onSuccess: () => {
      toast.success("Budget deleted");
      queryClient.invalidateQueries({ queryKey: ["expense-budgets"] });
    },
  });

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading budgets…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Budgets</h1>
          <p className="text-sm text-gray-500">Spend limits by category and period, with proactive alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <Plus size={16} /> New Budget
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(budgets ?? []).map((b) => (
          <div key={b.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{b.category?.name ?? "Overall"}</p>
                <p className="text-xs text-gray-400">{b.month ? `${b.year}-${String(b.month).padStart(2, "0")}` : `${b.year} (annual)`}</p>
              </div>
              <button onClick={() => removeMutation.mutate(b.id)} className="text-gray-300 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
            <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div className={`h-full ${progressColor(b.percentUsed)}`} style={{ width: `${Math.min(100, b.percentUsed)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                <Money amount={b.committedSpend} /> committed
              </span>
              <span>{b.percentUsed}% used</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-gray-500">Budget</span>
              <span className="font-semibold text-gray-900">
                <Money amount={Number(b.amount)} />
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Remaining</span>
              <span className={`font-semibold ${b.remaining < 0 ? "text-red-600" : "text-gray-900"}`}>
                <Money amount={b.remaining} />
              </span>
            </div>
          </div>
        ))}
        {(budgets ?? []).length === 0 && <p className="col-span-full py-8 text-center text-sm text-gray-400">No budgets set for {year}.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">New Budget</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Overall (all categories)</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input
                  placeholder="Month (blank = annual)"
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <input placeholder="Budget amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input
                placeholder="Alert threshold %"
                value={form.alertThresholdPercent}
                onChange={(e) => setForm({ ...form, alertThresholdPercent: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.amount || createMutation.isPending}
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
