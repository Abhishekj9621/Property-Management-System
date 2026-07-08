import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, X, Pencil, Trash2 } from "lucide-react";
import { guestsApi } from "../../api/guests.api";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import type { Guest } from "../../types";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";

const emptyForm = { firstName: "", lastName: "", email: "", phone: "" };

export default function GuestsPage() {
  useRealtimeSync(["guest:created", "guest:updated", "guest:deleted"], ["guests"]);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [deletingGuest, setDeletingGuest] = useState<Guest | null>(null);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data: guests, isLoading } = useQuery<Guest[]>({
    queryKey: ["guests", search],
    queryFn: () => guestsApi.list(search || undefined),
  });

  const createMutation = useMutation({
    mutationFn: () => guestsApi.create(form),
    onSuccess: () => {
      toast.success("Guest added");
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      setShowForm(false);
      setForm(emptyForm);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not add guest"),
  });

  const updateMutation = useMutation({
    mutationFn: () => guestsApi.update(editingGuest!.id, form),
    onSuccess: () => {
      toast.success("Guest updated");
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      setEditingGuest(null);
      setForm(emptyForm);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not update guest"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => guestsApi.delete(deletingGuest!.id),
    onSuccess: () => {
      toast.success("Guest deleted");
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      setDeletingGuest(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Could not delete guest");
      setDeletingGuest(null);
    },
  });

  const openEdit = (g: Guest) => {
    setEditingGuest(g);
    setForm({ firstName: g.firstName, lastName: g.lastName, email: g.email, phone: g.phone });
  };

  const closeModals = () => {
    setShowForm(false);
    setEditingGuest(null);
    setForm(emptyForm);
  };

  const isEditing = !!editingGuest;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guests</h1>
          <p className="text-sm text-gray-500">Guest profiles and stay history</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            placeholder="Search guests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add Guest
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Email", "Phone", "Loyalty Tier", "VIP", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading guests…
                </td>
              </tr>
            ) : guests?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No guests found.
                </td>
              </tr>
            ) : (
              guests?.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {g.firstName} {g.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{g.email}</td>
                  <td className="px-4 py-3 text-gray-600">{g.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{g.loyaltyTier}</td>
                  <td className="px-4 py-3">{g.vip ? "⭐" : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(g)}
                        className="flex items-center gap-1 rounded-md bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => setDeletingGuest(g)}
                        className="flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(showForm || isEditing) && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{isEditing ? "Edit Guest" : "Add Guest"}</h2>
              <button onClick={closeModals} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                isEditing ? updateMutation.mutate() : createMutation.mutate();
              }}
              className="space-y-3"
            >
              <input
                placeholder="First name"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Last name"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Phone"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {isEditing
                  ? updateMutation.isPending
                    ? "Saving…"
                    : "Save Changes"
                  : createMutation.isPending
                    ? "Adding…"
                    : "Add Guest"}
              </button>
            </form>
          </div>
        </div>
      )}

      {deletingGuest && (
        <ConfirmDialog
          title="Delete guest"
          message={`Delete ${deletingGuest.firstName} ${deletingGuest.lastName}? Guests with booking history can't be deleted — cancel/complete their bookings first.`}
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setDeletingGuest(null)}
        />
      )}
    </div>
  );
}
