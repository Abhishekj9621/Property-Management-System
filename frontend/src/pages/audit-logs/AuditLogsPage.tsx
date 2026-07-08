import { useEffect, useState } from "react";
import { ScrollText, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { auditLogsApi, type AuditLogEntry } from "../../api/auditLogs.api";

function formatAction(action: string) {
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function actionTone(action: string) {
  if (action.includes("FAILED") || action.includes("LOCKED") || action.includes("REUSE")) return "text-red-600 bg-red-50";
  if (action.includes("DEACTIVATED") || action.includes("REVOKED")) return "text-orange-600 bg-orange-50";
  if (action.includes("CREATED") || action.includes("SUCCESS") || action.includes("RESTORED")) return "text-green-600 bg-green-50";
  return "text-gray-600 bg-gray-100";
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AuditLogEntry[]; totalPages: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    auditLogsApi
      .list({ page, pageSize: 20 })
      .then(setData)
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-brand-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500">Authentication & staff-management activity trail.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.items.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {log.user ? `${log.user.firstName} ${log.user.lastName}` : "System / unauthenticated"}
                    {log.user && <div className="text-xs text-gray-400">{log.user.role}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionTone(log.action)}`}>
                      {formatAction(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {log.entity}
                    {log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{log.ipAddress ?? "—"}</td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    No audit events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Page {page} of {data.totalPages} · {data.total} events
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
