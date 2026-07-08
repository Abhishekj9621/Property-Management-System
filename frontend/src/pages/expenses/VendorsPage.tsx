import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, X, Trash2, TrendingUp } from "lucide-react";
import { vendorsApi } from "../../api/vendors.api";
import { Money } from "../../components/common/Money";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";
import type { Vendor } from "../../types";

export default function VendorsPage() {
  useRealtimeSync(["vendor:created", "vendor:updated", "vendor:deactivated"], ["vendors"]);

  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [spendFor, setSpendFor] = useState<Vendor | null>(null);
  const [form, setForm] = useState({ name: "", contactName: "", email: "", phone: "", paymentTerms: "" });

  const { data: vendors, isLoading } = useQuery<Vendor[]>({ queryKey: ["vendors", "all"], queryFn: () => vendorsApi.list(true) });

  const { data: spendSummary } = useQuery({
    queryKey: ["vendor-spend", spendFor?.id],
    queryFn: () => vendorsApi.spendSummary(spendFor!.id),
    enabled: !!spendFor,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      vendorsApi.create({
        name: form.name,
        contactName: form.contactName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        paymentTerms: form.paymentTerms || undefined,
      }),
    onSuccess: () => {
      toast.success("Vendor created");
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setShowForm(false);
      setForm({ name: "", contactName: "", email: "", phone: "", paymentTerms: "" });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not create vendor"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => vendorsApi.deactivate(id),
    onSuccess: () => {
      toast.success("Vendor deactivated");
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading vendors…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500">Suppliers and service providers billed against expenses</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus size={16} /> New Vendor
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Contact", "Email", "Phone", "Terms", "Scope", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(vendors ?? []).map((v) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{v.name}</td>
                <td className="px-4 py-3 text-gray-600">{v.contactName ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{v.email ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{v.phone ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{v.paymentTerms ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{v.hotelId ? "This hotel" : "Platform-wide"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {v.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setSpendFor(v)} className="text-gray-400 hover:text-brand-600" title="Spend summary">
                      <TrendingUp size={14} />
                    </button>
                    {v.hotelId && v.isActive && (
                      <button onClick={() => deactivateMutation.mutate(v.id)} className="text-gray-400 hover:text-red-500" title="Deactivate">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(vendors ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No vendors yet.
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
              <h2 className="text-lg font-bold text-gray-900">New Vendor</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <input placeholder="Vendor name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="Contact person" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input placeholder="Payment terms (e.g. Net 30)" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.name || createMutation.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {spendFor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{spendFor.name} — Spend Summary</h2>
              <button onClick={() => setSpendFor(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            {!spendSummary ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total spend (approved+)</span>
                  <span className="font-semibold text-gray-900">
                    <Money amount={spendSummary.totalSpend} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Expense count</span>
                  <span className="font-semibold text-gray-900">{spendSummary.expenseCount}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
