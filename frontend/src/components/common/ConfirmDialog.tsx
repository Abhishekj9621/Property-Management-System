import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  isLoading?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Shared modal used everywhere we need a "are you sure?" step before a
 * destructive action (delete guest, delete room, deactivate hotel, etc). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  isLoading = false,
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                danger ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-5 text-sm text-gray-600">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {isLoading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
