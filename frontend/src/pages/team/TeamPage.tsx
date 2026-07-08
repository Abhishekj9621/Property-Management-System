import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, X, KeyRound, UserX, RotateCcw, ShieldCheck } from "lucide-react";
import { usersApi } from "../../api/users.api";
import { hotelsApi } from "../../api/hotels.api";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { useAuthStore } from "../../store/authStore";
import { ROLE_HIERARCHY } from "../../lib/permissions";
import type { StaffUser, Hotel, Role } from "../../types";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  HOTEL_ADMIN: "Hotel Admin",
  MANAGER: "Manager",
  RECEPTIONIST: "Receptionist",
  HOUSEKEEPING: "Housekeeping",
  GUEST: "Guest",
};

const emptyForm = { email: "", password: "", firstName: "", lastName: "", phone: "", role: "" as Role | "", hotelId: "" };

export default function TeamPage() {
  useRealtimeSync(["staff:created", "staff:updated", "staff:deactivated", "staff:restored"], ["staff"]);

  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [hotelFilter, setHotelFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [resettingPasswordFor, setResettingPasswordFor] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deactivateTarget, setDeactivateTarget] = useState<StaffUser | null>(null);

  const manageableRoles = user ? ROLE_HIERARCHY[user.role] : [];

  const { data: staff, isLoading } = useQuery<StaffUser[]>({
    queryKey: ["staff", hotelFilter, includeInactive],
    queryFn: () =>
      usersApi.list({
        hotelId: isSuperAdmin && hotelFilter ? hotelFilter : undefined,
        includeInactive,
      }),
  });

  const { data: hotels } = useQuery<Hotel[]>({
    queryKey: ["hotels", "active-for-team"],
    queryFn: () => hotelsApi.list({ status: "active" }),
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      usersApi.create({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        role: form.role as string,
        hotelId: isSuperAdmin ? form.hotelId || undefined : undefined,
      }),
    onSuccess: (created) => {
      toast.success(`${created.firstName} ${created.lastName} added as ${ROLE_LABELS[created.role]}`);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setShowForm(false);
      setForm(emptyForm);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not create staff account"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => usersApi.resetPassword(resettingPasswordFor!.id, newPassword),
    onSuccess: () => {
      toast.success(`Password reset for ${resettingPasswordFor!.firstName}`);
      setResettingPasswordFor(null);
      setNewPassword("");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not reset password"),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => usersApi.deactivate(deactivateTarget!.id),
    onSuccess: () => {
      toast.success(`${deactivateTarget!.firstName} deactivated`);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setDeactivateTarget(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Could not deactivate account");
      setDeactivateTarget(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => usersApi.restore(id),
    onSuccess: () => {
      toast.success("Account restored");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not restore account"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500">
            {isSuperAdmin
              ? "Create Hotel Admins and staff, and assign each one to a specific hotel."
              : "Staff you're responsible for at your hotel."}
          </p>
        </div>
        {manageableRoles.length > 0 && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add Staff
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isSuperAdmin && (
          <select
            value={hotelFilter}
            onChange={(e) => setHotelFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All hotels</option>
            {hotels?.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          Show deactivated
        </label>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-gray-400">Loading team…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Hotel</th>
                <th className="px-4 py-3">Created by</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff?.map((s) => (
                <tr key={s.id} className={!s.isActive ? "opacity-50" : ""}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {s.firstName} {s.lastName}
                      {s.id === user?.id && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}
                    </div>
                    <div className="text-xs text-gray-500">{s.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      {s.role === "SUPER_ADMIN" && <ShieldCheck className="h-3 w-3" />}
                      {ROLE_LABELS[s.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.hotel?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.createdBy ? `${s.createdBy.firstName} ${s.createdBy.lastName}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {s.isActive ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      {s.isActive && s.id !== user?.id && (
                        <>
                          <button
                            onClick={() => setResettingPasswordFor(s)}
                            title="Reset password"
                            className="rounded-md bg-gray-50 p-1.5 text-gray-600 hover:bg-gray-100"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeactivateTarget(s)}
                            title="Deactivate"
                            className="rounded-md bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {!s.isActive && (
                        <button
                          onClick={() => restoreMutation.mutate(s.id)}
                          title="Restore"
                          className="rounded-md bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {staff?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    No staff found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Add Staff</h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
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
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="First name"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Last name"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <input
                placeholder="Email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Temporary password (min 8 chars)"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <select
                required
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Role…</option>
                {manageableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              {isSuperAdmin && (
                <select
                  required
                  value={form.hotelId}
                  onChange={(e) => setForm({ ...form, hotelId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Assign to hotel…</option>
                  {hotels?.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              )}
              {!isSuperAdmin && (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  This account will be assigned to your hotel and will only be able to access that property.
                </p>
              )}
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating…" : "Create Staff Account"}
              </button>
            </form>
          </div>
        </div>
      )}

      {resettingPasswordFor && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Reset Password</h2>
              <button
                onClick={() => {
                  setResettingPasswordFor(null);
                  setNewPassword("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-gray-500">
              For {resettingPasswordFor.firstName} {resettingPasswordFor.lastName} ({resettingPasswordFor.email})
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                resetPasswordMutation.mutate();
              }}
              className="space-y-3"
            >
              <input
                placeholder="New password (min 8 chars)"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={resetPasswordMutation.isPending}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {resetPasswordMutation.isPending ? "Resetting…" : "Reset Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {deactivateTarget && (
        <ConfirmDialog
          title="Deactivate account"
          message={`Deactivate ${deactivateTarget.firstName} ${deactivateTarget.lastName}'s account? They'll immediately lose access, and you can restore the account later.`}
          confirmLabel="Deactivate"
          isLoading={deactivateMutation.isPending}
          onConfirm={() => deactivateMutation.mutate()}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}
    </div>
  );
}
