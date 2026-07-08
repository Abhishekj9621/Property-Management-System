import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, X, FileText, Ban, CheckCircle2, Receipt, Trash2 } from "lucide-react";
import { invoicesApi } from "../../api/invoices.api";
import { creditNotesApi } from "../../api/creditNotes.api";
import { guestsApi } from "../../api/guests.api";
import { Badge } from "../../components/common/Badge";
import { Money } from "../../components/common/Money";
import { useAuthStore } from "../../store/authStore";
import { can, FINANCE_MANAGERS } from "../../lib/permissions";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";
import type { Invoice, Guest } from "../../types";

type LineItemDraft = { description: string; quantity: string; unitPrice: string; taxPercent: string };
const emptyLineItem = (): LineItemDraft => ({ description: "", quantity: "1", unitPrice: "", taxPercent: "0" });

export default function InvoicesPage() {
  useRealtimeSync(["invoice:created", "invoice:issued", "invoice:voided", "invoice:paid", "creditnote:issued"], ["financial-invoices"]);

  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isManager = can(user?.role, FINANCE_MANAGERS);

  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [creditNoteTarget, setCreditNoteTarget] = useState<Invoice | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");

  const [form, setForm] = useState({ guestId: "", notes: "", discount: "0" });
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([emptyLineItem()]);

  const { data, isLoading } = useQuery({
    queryKey: ["financial-invoices", statusFilter],
    queryFn: () => invoicesApi.list(statusFilter ? { status: statusFilter } : undefined),
  });
  const invoices: Invoice[] = data?.data ?? [];
  const summary: { status: string; total: number }[] = data?.meta?.summary ?? [];

  const { data: guests } = useQuery<Guest[]>({ queryKey: ["guests"], queryFn: () => guestsApi.list() });

  const resetForm = () => {
    setForm({ guestId: "", notes: "", discount: "0" });
    setLineItems([emptyLineItem()]);
  };

  const createMutation = useMutation({
    mutationFn: () => {
      if (!form.guestId) {
        throw { response: { data: { message: "Select a guest before creating the invoice" } } };
      }

      // Only rows the user actually started filling in count as "attempted" —
      // a totally blank spare row (from clicking "+ Add line item" and not
      // filling it in) is silently dropped rather than flagged as an error.
      const attempted = lineItems.filter((li) => li.description.trim() || li.unitPrice.trim());
      if (attempted.length === 0) {
        throw { response: { data: { message: "Add at least one line item with a description and unit price" } } };
      }

      const parsed = attempted.map((li, idx) => {
        const rowLabel = `Line item ${idx + 1}`;
        if (!li.description.trim()) throw { response: { data: { message: `${rowLabel}: description is required` } } };

        const unitPrice = Number(li.unitPrice);
        if (li.unitPrice.trim() === "" || Number.isNaN(unitPrice) || unitPrice < 0) {
          throw { response: { data: { message: `${rowLabel} ("${li.description}"): enter a valid unit price` } } };
        }

        const quantity = Number(li.quantity || 1);
        if (Number.isNaN(quantity) || quantity <= 0) {
          throw { response: { data: { message: `${rowLabel} ("${li.description}"): quantity must be a positive number` } } };
        }

        const taxPercent = Number(li.taxPercent || 0);
        if (Number.isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) {
          throw { response: { data: { message: `${rowLabel} ("${li.description}"): tax % must be between 0 and 100` } } };
        }

        return { description: li.description.trim(), quantity, unitPrice, taxPercent };
      });

      return invoicesApi.create({
        guestId: form.guestId,
        notes: form.notes || undefined,
        discount: Number(form.discount || 0),
        type: "STANDARD",
        asDraft: false,
        lineItems: parsed,
      });
    },
    onSuccess: () => {
      toast.success("Invoice created");
      queryClient.invalidateQueries({ queryKey: ["financial-invoices"] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not create invoice"),
  });

  const voidMutation = useMutation({
    mutationFn: () => invoicesApi.void(voidTarget!.id, voidReason),
    onSuccess: () => {
      toast.success("Invoice voided");
      queryClient.invalidateQueries({ queryKey: ["financial-invoices"] });
      setVoidTarget(null);
      setVoidReason("");
      setSelected(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not void invoice"),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.markPaid(id),
    onSuccess: () => {
      toast.success("Invoice marked as paid");
      queryClient.invalidateQueries({ queryKey: ["financial-invoices"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not update invoice"),
  });

  const creditNoteMutation = useMutation({
    mutationFn: () => creditNotesApi.create({ invoiceId: creditNoteTarget!.id, amount: Number(creditAmount), reason: creditReason }),
    onSuccess: () => {
      toast.success("Credit note issued");
      queryClient.invalidateQueries({ queryKey: ["financial-invoices"] });
      setCreditNoteTarget(null);
      setCreditAmount("");
      setCreditReason("");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not issue credit note"),
  });

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading invoices…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500">Booking and ad-hoc invoices for this property</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={16} /> New Invoice
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["", "DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"].map((s) => (
          <button
            key={s || "ALL"}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusFilter === s ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {s || "All"} {summary.find((x) => x.status === s)?.total !== undefined && s ? `(${summary.find((x) => x.status === s)?.total})` : ""}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Invoice #", "Guest / Booking", "Status", "Total", "Paid", "Issued", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No invoices found.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(inv)}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-gray-800">
                    {inv.guest ? `${inv.guest.firstName} ${inv.guest.lastName}` : "—"}
                    {inv.booking && <span className="ml-1 text-xs text-gray-400">({inv.booking.bookingRef})</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Money amount={Number(inv.total)} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <Money amount={Number(inv.amountPaid)} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{new Date(inv.issuedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right text-xs text-brand-600">View</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create invoice modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">New Ad-hoc Invoice</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Guest</label>
                <select
                  value={form.guestId}
                  onChange={(e) => setForm({ ...form, guestId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a guest…</option>
                  {guests?.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.firstName} {g.lastName} — {g.email}
                    </option>
                  ))}
                </select>
                {guests?.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">No guests on file yet — add one from the Guests page first.</p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">Line Items</p>
                {lineItems.length > 0 && (
                  <div className="grid grid-cols-12 gap-2 px-0.5 text-[11px] font-medium text-gray-400">
                    <span className="col-span-5">Description</span>
                    <span className="col-span-2">Qty</span>
                    <span className="col-span-2">Unit price (₹)</span>
                    <span className="col-span-2">Tax %</span>
                    <span className="col-span-1"></span>
                  </div>
                )}
                {lineItems.map((li, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <input
                      placeholder="Description"
                      value={li.description}
                      onChange={(e) => setLineItems((prev) => prev.map((p, i) => (i === idx ? { ...p, description: e.target.value } : p)))}
                      className="col-span-5 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      placeholder="Qty"
                      value={li.quantity}
                      onChange={(e) => setLineItems((prev) => prev.map((p, i) => (i === idx ? { ...p, quantity: e.target.value } : p)))}
                      className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      placeholder="Unit Price"
                      value={li.unitPrice}
                      onChange={(e) => setLineItems((prev) => prev.map((p, i) => (i === idx ? { ...p, unitPrice: e.target.value } : p)))}
                      className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      placeholder="Tax %"
                      value={li.taxPercent}
                      onChange={(e) => setLineItems((prev) => prev.map((p, i) => (i === idx ? { ...p, taxPercent: e.target.value } : p)))}
                      className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <button onClick={() => setLineItems((prev) => prev.filter((_, i) => i !== idx))} className="col-span-1 text-gray-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button onClick={() => setLineItems((prev) => [...prev, emptyLineItem()])} className="text-xs font-medium text-brand-600 hover:underline">
                  + Add line item
                </button>
              </div>
              <input
                placeholder="Discount amount"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={2}
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.guestId || createMutation.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating…" : "Create & Issue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-600" />
                <h2 className="text-lg font-bold text-gray-900">{selected.invoiceNumber}</h2>
                <Badge status={selected.status} />
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Guest</p>
                <p className="font-medium text-gray-900">{selected.guest ? `${selected.guest.firstName} ${selected.guest.lastName}` : "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Booking</p>
                <p className="font-medium text-gray-900">{selected.booking?.bookingRef ?? "Ad-hoc"}</p>
              </div>
            </div>

            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="py-1">Description</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1 text-right">Unit Price</th>
                  <th className="py-1 text-right">Tax %</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {selected.lineItems.map((li) => (
                  <tr key={li.id} className="border-b border-gray-50">
                    <td className="py-1.5">{li.description}</td>
                    <td className="py-1.5 text-right">{Number(li.quantity)}</td>
                    <td className="py-1.5 text-right">
                      <Money amount={Number(li.unitPrice)} />
                    </td>
                    <td className="py-1.5 text-right">{Number(li.taxPercent)}%</td>
                    <td className="py-1.5 text-right">
                      <Money amount={Number(li.amount)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mb-5 ml-auto w-56 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <Money amount={Number(selected.subtotal)} />
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <Money amount={Number(selected.tax)} />
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Discount</span>
                <Money amount={Number(selected.discount)} />
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 font-bold text-gray-900">
                <span>Total</span>
                <Money amount={Number(selected.total)} />
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Paid</span>
                <Money amount={Number(selected.amountPaid)} />
              </div>
            </div>

            {selected.creditNotes && selected.creditNotes.length > 0 && (
              <div className="mb-5">
                <p className="mb-1 text-xs font-semibold text-gray-500">Credit Notes</p>
                {selected.creditNotes.map((cn) => (
                  <div key={cn.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
                    <span>
                      {cn.creditNoteNumber} — {cn.reason}
                    </span>
                    <span className="font-medium">
                      <Money amount={Number(cn.amount)} /> <Badge status={cn.status} />
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {!selected.bookingId && !["VOID", "DRAFT"].includes(selected.status) && selected.status !== "PAID" && (
                <button
                  onClick={() => markPaidMutation.mutate(selected.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  <CheckCircle2 size={14} /> Mark Paid
                </button>
              )}
              {isManager && selected.status !== "VOID" && selected.status !== "DRAFT" && (
                <button
                  onClick={() => setCreditNoteTarget(selected)}
                  className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100"
                >
                  <Receipt size={14} /> Issue Credit Note
                </button>
              )}
              {isManager && selected.status !== "VOID" && selected.status !== "PAID" && (
                <button
                  onClick={() => setVoidTarget(selected)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  <Ban size={14} /> Void
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Void confirm */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-3 text-base font-bold text-gray-900">Void {voidTarget.invoiceNumber}?</h2>
            <textarea
              placeholder="Reason for voiding"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setVoidTarget(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">
                Cancel
              </button>
              <button
                onClick={() => voidMutation.mutate()}
                disabled={!voidReason || voidMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {voidMutation.isPending ? "Voiding…" : "Void Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit note modal */}
      {creditNoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-3 text-base font-bold text-gray-900">Issue Credit Note — {creditNoteTarget.invoiceNumber}</h2>
            <input
              placeholder="Amount"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Reason"
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setCreditNoteTarget(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">
                Cancel
              </button>
              <button
                onClick={() => creditNoteMutation.mutate()}
                disabled={!creditAmount || !creditReason || creditNoteMutation.isPending}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {creditNoteMutation.isPending ? "Issuing…" : "Issue Credit Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
