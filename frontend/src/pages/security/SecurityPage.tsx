import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { LogOut, Monitor, ShieldCheck, Loader2 } from "lucide-react";
import { authApi, type Session } from "../../api/auth.api";
import { useAuthStore } from "../../store/authStore";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function describeDevice(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  if (/mobile/i.test(userAgent)) return "Mobile browser";
  if (/chrome/i.test(userAgent)) return "Chrome";
  if (/firefox/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent)) return "Safari";
  return "Browser";
}

export default function SecurityPage() {
  const { refreshToken } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await authApi.listSessions(refreshToken ?? undefined);
      setSessions(data);
    } catch {
      toast.error("Couldn't load your active sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await authApi.revokeSession(id);
      toast.success("Session revoked");
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error("Couldn't revoke that session");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    try {
      await authApi.revokeAllSessions(refreshToken ?? undefined);
      toast.success("All other sessions were signed out");
      setConfirmRevokeAll(false);
      load();
    } catch {
      toast.error("Couldn't revoke other sessions");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Security</h1>
        <p className="mt-1 text-sm text-gray-500">Manage where you're signed in.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-gray-900">Active sessions</h2>
          </div>
          {sessions.length > 1 && (
            <button
              onClick={() => setConfirmRevokeAll(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out all other sessions
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-start gap-3">
                  <Monitor className="mt-0.5 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {describeDevice(s.userAgent)}
                      {s.isCurrent && (
                        <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          This device
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.ipAddress ?? "Unknown IP"} · signed in {formatDate(s.createdAt)}
                    </p>
                  </div>
                </div>
                {!s.isCurrent && (
                  <button
                    onClick={() => handleRevoke(s.id)}
                    disabled={revokingId === s.id}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {revokingId === s.id ? "Revoking…" : "Revoke"}
                  </button>
                )}
              </li>
            ))}
            {sessions.length === 0 && <li className="px-5 py-8 text-center text-sm text-gray-400">No active sessions found.</li>}
          </ul>
        )}
      </div>

      {confirmRevokeAll && (
        <ConfirmDialog
          title="Sign out all other sessions?"
          message="You'll remain signed in on this device, but every other browser or device will be signed out immediately."
          confirmLabel="Sign out others"
          danger
          onConfirm={handleRevokeAll}
          onCancel={() => setConfirmRevokeAll(false)}
        />
      )}
    </div>
  );
}
