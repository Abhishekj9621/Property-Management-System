import clsx from "clsx";

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  RESERVED: "bg-blue-100 text-blue-700",
  OCCUPIED: "bg-purple-100 text-purple-700",
  DIRTY: "bg-orange-100 text-orange-700",
  CLEANING: "bg-yellow-100 text-yellow-700",
  MAINTENANCE: "bg-red-100 text-red-700",
  OUT_OF_SERVICE: "bg-gray-100 text-gray-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-green-100 text-green-700",
  CHECKED_OUT: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-red-100 text-red-700",
  // Financial Management module
  DRAFT: "bg-gray-100 text-gray-700",
  ISSUED: "bg-blue-100 text-blue-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  VOID: "bg-gray-200 text-gray-500",
  REQUESTED: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  PROCESSED: "bg-green-100 text-green-700",
  OPEN: "bg-blue-100 text-blue-700",
  CLOSED: "bg-gray-200 text-gray-700",
};

export function Badge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusColors[status] ?? "bg-gray-100 text-gray-700"
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
