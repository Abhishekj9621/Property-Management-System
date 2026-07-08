import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, X, Pencil, Trash2 } from "lucide-react";
import { housekeepingApi } from "../../api/housekeeping.api";
import { roomsApi } from "../../api/rooms.api";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { useAuthStore } from "../../store/authStore";
import { can, MANAGE } from "../../lib/permissions";
import type { Room } from "../../types";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";

const COLUMNS = ["PENDING", "IN_PROGRESS", "COMPLETED", "VERIFIED"] as const;
const TASK_TYPES = ["CHECKOUT_CLEAN", "TURNDOWN", "MAINTENANCE", "DEEP_CLEAN", "INSPECTION"];

export default function HousekeepingPage() {
  useRealtimeSync(["housekeeping:task-updated", "housekeeping:task-created", "housekeeping:task-deleted", "room:status-changed"], ["housekeeping", "rooms"]);

  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const canCreate = can(user?.role, MANAGE);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [deletingTask, setDeletingTask] = useState<any | null>(null);
  const [form, setForm] = useState({ roomId: "", type: "CHECKOUT_CLEAN", priority: "1", notes: "" });
  const [editForm, setEditForm] = useState({ priority: "1", notes: "" });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["housekeeping"],
    queryFn: () => housekeepingApi.list(),
  });

  const { data: rooms } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: () => roomsApi.listRooms(),
    enabled: canCreate,
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => housekeepingApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["housekeeping"] });
      toast.success("Task updated");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Update failed"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      housekeepingApi.create({
        roomId: form.roomId,
        type: form.type,
        priority: Number(form.priority) || 1,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Task created");
      queryClient.invalidateQueries({ queryKey: ["housekeeping"] });
      setShowForm(false);
      setForm({ roomId: "", type: "CHECKOUT_CLEAN", priority: "1", notes: "" });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not create task"),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      housekeepingApi.update(editingTask!.id, {
        priority: Number(editForm.priority) || 1,
        notes: editForm.notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Task updated");
      queryClient.invalidateQueries({ queryKey: ["housekeeping"] });
      setEditingTask(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not update task"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => housekeepingApi.delete(deletingTask!.id),
    onSuccess: () => {
      toast.success("Task deleted");
      queryClient.invalidateQueries({ queryKey: ["housekeeping"] });
      setDeletingTask(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Could not delete task");
      setDeletingTask(null);
    },
  });

  const openEdit = (t: any) => {
    setEditingTask(t);
    setEditForm({ priority: String(t.priority ?? 1), notes: t.notes ?? "" });
  };

  const nextStatus: Record<string, string> = {
    PENDING: "IN_PROGRESS",
    IN_PROGRESS: "COMPLETED",
    COMPLETED: "VERIFIED",
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading tasks…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Housekeeping</h1>
          <p className="text-sm text-gray-500">Room cleaning & maintenance task board</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> New Task
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => (
          <div key={col} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {col.replace(/_/g, " ")} ({tasks?.filter((t: any) => t.status === col).length ?? 0})
            </h2>
            <div className="space-y-2">
              {tasks
                ?.filter((t: any) => t.status === col)
                .map((t: any) => (
                  <div key={t.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-sm font-medium text-gray-900">Room {t.room.roomNumber}</p>
                    <p className="text-xs text-gray-500">{t.type.replace(/_/g, " ")}</p>
                    {t.notes && <p className="mt-1 text-xs text-gray-500 italic">{t.notes}</p>}
                    {t.assignee && (
                      <p className="mt-1 text-xs text-gray-400">
                        {t.assignee.firstName} {t.assignee.lastName}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {nextStatus[col] && (
                        <button
                          onClick={() => advanceMutation.mutate({ id: t.id, status: nextStatus[col] })}
                          className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                        >
                          Mark {nextStatus[col].replace(/_/g, " ").toLowerCase()}
                        </button>
                      )}
                      {canCreate && (
                        <>
                          <button
                            onClick={() => openEdit(t)}
                            className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => setDeletingTask(t)}
                            className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              {tasks?.filter((t: any) => t.status === col).length === 0 && (
                <p className="text-xs text-gray-400">No tasks</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">New Housekeeping Task</h2>
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
                <label className="mb-1 block text-xs font-medium text-gray-600">Room</label>
                <select
                  required
                  value={form.roomId}
                  onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a room…</option>
                  {rooms?.map((r) => (
                    <option key={r.id} value={r.id}>
                      #{r.roomNumber} — {r.roomType?.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Task type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Priority (1-5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <textarea
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={2}
              />
              <button
                type="submit"
                disabled={createMutation.isPending || !form.roomId}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating…" : "Create Task"}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingTask && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                Edit Task — Room {editingTask.room.roomNumber}
              </h2>
              <button onClick={() => setEditingTask(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                editMutation.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Priority (1-5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <textarea
                placeholder="Notes (optional)"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={2}
              />
              <button
                type="submit"
                disabled={editMutation.isPending}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {editMutation.isPending ? "Saving…" : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      {deletingTask && (
        <ConfirmDialog
          title="Delete task"
          message={`Delete this ${deletingTask.type.replace(/_/g, " ").toLowerCase()} task for room ${deletingTask.room.roomNumber}?`}
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setDeletingTask(null)}
        />
      )}
    </div>
  );
}
