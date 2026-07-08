import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, X, Trash2, Star } from "lucide-react";
import { taxRatesApi } from "../../api/taxRates.api";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";
import type { TaxRate } from "../../types";

export default function TaxRatesPage() {
  useRealtimeSync(["taxrate:created", "taxrate:updated", "taxrate:deactivated"], ["tax-rates"]);

  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", percentage: "", isDefault: false });

  const { data, isLoading } = useQuery<TaxRate[]>({ queryKey: ["tax-rates"], queryFn: () => taxRatesApi.list(true) });
  const rates = data ?? [];

  const createMutation = useMutation({
    mutationFn: () => taxRatesApi.create({ name: form.name, code: form.code || undefined, percentage: Number(form.percentage), isDefault: form.isDefault }),
    onSuccess: () => {
      toast.success("Tax rate created");
      queryClient.invalidateQueries({ queryKey: ["tax-rates"] });
      setShowForm(false);
      setForm({ name: "", code: "", percentage: "", isDefault: false });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not create tax rate"),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => taxRatesApi.update(id, { isDefault: true }),
    onSuccess: () => {
      toast.success("Default tax rate updated");
      queryClient.invalidateQueries({ queryKey: ["tax-rates"] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => (isActive ? taxRatesApi.update(id, { isActive: true }) : taxRatesApi.remove(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-rates"] });
      toast.success("Tax rate updated");
    },
  });

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading tax rates…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Rates</h1>
          <p className="text-sm text-gray-500">GST / tax slabs applied to invoices for this property</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus size={16} /> New Tax Rate
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Code", "Percentage", "Scope", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rates.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <span className="flex items-center gap-1.5">
                    {r.isDefault && <Star size={14} className="fill-amber-400 text-amber-400" />}
                    {r.name}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.code ?? "—"}</td>
                <td className="px-4 py-3 text-gray-800">{Number(r.percentage)}%</td>
                <td className="px-4 py-3 text-gray-500">{r.hotelId ? "This hotel" : "Platform-wide"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {r.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.hotelId && (
                    <div className="flex justify-end gap-2">
                      {!r.isDefault && r.isActive && (
                        <button onClick={() => setDefaultMutation.mutate(r.id)} className="text-xs font-medium text-brand-600 hover:underline">
                          Make default
                        </button>
                      )}
                      {r.isActive && (
                        <button onClick={() => toggleActiveMutation.mutate({ id: r.id, isActive: false })} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">New Tax Rate</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <input placeholder="Name (e.g. GST 12%)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="Code (optional)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="Percentage" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
                Set as default for this hotel
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.name || !form.percentage || createMutation.isPending}
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
