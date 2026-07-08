import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Plus, CreditCard, X, Trash2 } from "lucide-react";
import { bookingsApi } from "../../api/bookings.api";
import { paymentsApi } from "../../api/payments.api";
import { Badge } from "../../components/common/Badge";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import type { Booking } from "../../types";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";

const PAYMENT_METHODS = ["CARD", "CASH", "BANK_TRANSFER", "WALLET"];

export default function BookingsPage() {
  useRealtimeSync(
    ["booking:created", "booking:updated", "booking:checked-in", "booking:checked-out", "booking:deleted", "payment:recorded"],
    ["bookings", "payments"]
  );

  const [status, setStatus] = useState("");
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);
  const [amendingBooking, setAmendingBooking] = useState<Booking | null>(null);
  const [amendForm, setAmendForm] = useState({ checkInDate: "", checkOutDate: "" });
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", status],
    queryFn: () => bookingsApi.list(status ? { status } : undefined),
  });

  const checkInMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.checkIn(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Guest checked in");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Check-in failed"),
  });

  const checkOutMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.checkOut(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Guest checked out");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Check-out failed"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.updateStatus(id, "CANCELLED", "Cancelled by staff"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking cancelled");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking deleted");
      setDeletingBooking(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Could not delete booking");
      setDeletingBooking(null);
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: () =>
      paymentsApi.recordPayment({
        bookingId: paymentBooking!.id,
        amount: Number(paymentAmount),
        method: paymentMethod,
      }),
    onSuccess: () => {
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setPaymentBooking(null);
      setPaymentAmount("");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not record payment"),
  });

  const amendMutation = useMutation({
    mutationFn: () =>
      bookingsApi.amend(amendingBooking!.id, {
        checkInDate: amendForm.checkInDate || undefined,
        checkOutDate: amendForm.checkOutDate || undefined,
      }),
    onSuccess: () => {
      toast.success("Booking updated");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setAmendingBooking(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not amend booking"),
  });

  const bookings: Booking[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-sm text-gray-500">Manage reservations, check-ins and check-outs</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <Link
            to="/bookings/new"
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> New Booking
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Ref", "Guest", "Rooms", "Check-in", "Check-out", "Status", "Total", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  Loading bookings…
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No bookings found.
                </td>
              </tr>
            ) : (
              bookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{b.bookingRef}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {b.guest.firstName} {b.guest.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.rooms.map((r) => r.room.roomNumber).join(", ")}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(b.checkInDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(b.checkOutDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Badge status={b.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-900">₹{Number(b.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {b.status === "CONFIRMED" && (
                        <button
                          onClick={() => checkInMutation.mutate(b.id)}
                          className="rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                        >
                          Check-in
                        </button>
                      )}
                      {b.status === "CHECKED_IN" && (
                        <button
                          onClick={() => checkOutMutation.mutate(b.id)}
                          className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          Check-out
                        </button>
                      )}
                      {(b.status === "PENDING" || b.status === "CONFIRMED") && (
                        <button
                          onClick={() => {
                            setAmendingBooking(b);
                            setAmendForm({
                              checkInDate: new Date(b.checkInDate).toISOString().slice(0, 10),
                              checkOutDate: new Date(b.checkOutDate).toISOString().slice(0, 10),
                            });
                          }}
                          className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                        >
                          Amend
                        </button>
                      )}
                      {(b.status === "PENDING" || b.status === "CONFIRMED") && (
                        <button
                          onClick={() => cancelMutation.mutate(b.id)}
                          className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          Cancel
                        </button>
                      )}
                      {Number(b.paidAmount) < Number(b.totalAmount) && b.status !== "CANCELLED" && (
                        <button
                          onClick={() => {
                            setPaymentBooking(b);
                            setPaymentAmount((Number(b.totalAmount) - Number(b.paidAmount)).toFixed(2));
                          }}
                          className="flex items-center gap-1 rounded-md bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          <CreditCard className="h-3 w-3" /> Pay
                        </button>
                      )}
                      {(b.status === "PENDING" || b.status === "CANCELLED") && Number(b.paidAmount) === 0 && (
                        <button
                          onClick={() => setDeletingBooking(b)}
                          className="flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paymentBooking && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Record Payment</h2>
              <button onClick={() => setPaymentBooking(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              Booking <span className="font-mono">{paymentBooking.bookingRef}</span> — balance due ₹
              {(Number(paymentBooking.totalAmount) - Number(paymentBooking.paidAmount)).toFixed(2)}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                recordPaymentMutation.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Amount</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={recordPaymentMutation.isPending}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {recordPaymentMutation.isPending ? "Recording…" : "Record Payment"}
              </button>
            </form>
          </div>
        </div>
      )}
      {amendingBooking && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Amend Booking</h2>
              <button onClick={() => setAmendingBooking(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              Booking <span className="font-mono">{amendingBooking.bookingRef}</span> — change the stay dates.
              Rooms are re-checked for availability on the new dates before saving.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                amendMutation.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Check-in</label>
                <input
                  type="date"
                  required
                  value={amendForm.checkInDate}
                  onChange={(e) => setAmendForm({ ...amendForm, checkInDate: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Check-out</label>
                <input
                  type="date"
                  required
                  value={amendForm.checkOutDate}
                  onChange={(e) => setAmendForm({ ...amendForm, checkOutDate: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={amendMutation.isPending}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {amendMutation.isPending ? "Saving…" : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
      {deletingBooking && (
        <ConfirmDialog
          title="Delete booking"
          message={`Delete booking ${deletingBooking.bookingRef}? Only pending or cancelled bookings with no payments can be deleted this way.`}
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deletingBooking.id)}
          onCancel={() => setDeletingBooking(null)}
        />
      )}
    </div>
  );
}
