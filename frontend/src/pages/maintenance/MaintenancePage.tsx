import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, X, Wrench } from "lucide-react";
import { maintenanceApi } from "../../api/maintenance.api";
import { useAuthStore } from "../../store/authStore";
import { can, MANAGE } from "../../lib/permissions";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";
import type { MaintenanceRequest } from "../../types";

const COLUMNS = ["OPEN", "IN_PROGRESS", "ON_HOLD", "COMPLETED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-700",
  CRITICAL: "bg-red-50 text-red-700",
};

export default function MaintenancePage() {
  useRealtimeSync(
    ["maintenance:request-created", "maintenance:request-updated", "maintenance:request-deleted"],
    ["maintenance"]
  );

  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const canManage = can(user?.role, MANAGE);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", location: "", priority: "MEDIUM" });

  const { data: requests, isLoading } = useQuery<MaintenanceRequest[]>({
    queryKey: ["maintenance"],
    queryFn: () => maintenanceApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      maintenanceApi.create({
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        priority: form.priority,
      }),
    onSuccess: () => {
      toast.success("Request logged");
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      setShowForm(false);
      setForm({ title: "", description: "", location: "", priority: "MEDIUM" });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not create request"),
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => maintenanceApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      toast.success("Request updated");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Update failed"),
  });

  const nextStatus: Record<string, string> = {
    OPEN: "IN_PROGRESS",
    IN_PROGRESS: "COMPLETED",
    ON_HOLD: "IN_PROGRESS",
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading requests…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
          <p className="text-sm text-gray-500">Work orders, assets & repair tracking</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Report issue
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => (
          <div key={col} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {col.replace(/_/g, " ")} ({requests?.filter((r) => r.status === col).length ?? 0})
            </h2>
            <div className="space-y-2">
              {requests
                ?.filter((r) => r.status === col)
                .map((r) => (
                  <div key={r.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">{r.title}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_COLORS[r.priority]}`}>
                        {r.priority}
                      </span>
                    </div>
                    {r.location && <p className="mt-0.5 text-xs text-gray-500">{r.location}</p>}
                    {r.description && <p className="mt-1 text-xs text-gray-500 italic">{r.description}</p>}
                    {r.assignee && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                        <Wrench className="h-3 w-3" /> {r.assignee.firstName} {r.assignee.lastName}
                      </p>
                    )}
                    {nextStatus[col] && (
                      <button
                        onClick={() => advanceMutation.mutate({ id: r.id, status: nextStatus[col] })}
                        className="mt-2 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                      >
                        Mark {nextStatus[col].replace(/_/g, " ").toLowerCase()}
                      </button>
                    )}
                    {canManage && col !== "COMPLETED" && col !== "ON_HOLD" && (
                      <button
                        onClick={() => advanceMutation.mutate({ id: r.id, status: "ON_HOLD" })}
                        className="ml-1.5 mt-2 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        Hold
                      </button>
                    )}
                  </div>
                ))}
              {requests?.filter((r) => r.status === col).length === 0 && <p className="text-xs text-gray-400">No requests</p>}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Report a maintenance issue</h2>
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
                  placeholder="e.g. AC not cooling in Room 204"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Room 204, Rooftop, Kitchen…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {createMutation.isPending ? "Submitting…" : "Submit request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
