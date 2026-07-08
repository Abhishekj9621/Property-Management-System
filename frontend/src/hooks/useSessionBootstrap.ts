import { useEffect, useState } from "react";
import axios from "axios";
import { useAuthStore } from "../store/authStore";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

// Module-level (not component-level) cache of the in-flight bootstrap
// request. This is the key to the fix below: it's shared across every
// invocation of the effect, including React 18 Strict Mode's intentional
// double-invoke in development.
//
// Refresh tokens are single-use and rotated on every redemption (see
// auth.service.ts). Strict Mode fires this effect twice back-to-back, and
// without this cache both invocations would read the same persisted
// refreshToken and race each other to POST /auth/refresh. The first call
// wins and rotates the token; the second replays a token that's already
// been consumed. The backend correctly treats a replayed/revoked refresh
// token as a sign of theft and revokes the *entire* session — so the
// second call's `.catch()` fires clearSession(), and the user gets bounced
// to /login on every single reload. The axios response interceptor already
// guards its own refresh calls this way (see api/axios.ts's isRefreshing/
// pendingQueue); this hook needs the same protection.
let bootstrapPromise: Promise<void> | null = null;

/**
 * Returns `true` once it's safe to render protected routes / open the
 * realtime socket — i.e. either there was nothing to restore, or the
 * restore attempt (success or failure) has finished.
 */
export function useSessionBootstrap(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!bootstrapPromise) {
      const { user, accessToken, refreshToken, setSession, clearSession } = useAuthStore.getState();

      if (!user || accessToken || !refreshToken) {
        // Nothing to restore: either there's no persisted session, or an
        // access token already exists (e.g. hot reload in dev), or there's
        // no refresh token to restore it with (treat as logged out).
        bootstrapPromise = Promise.resolve();
      } else {
        bootstrapPromise = axios
          .post(`${API_URL}/auth/refresh`, { refreshToken })
          .then(({ data }) => {
            const { accessToken: newAccessToken, refreshToken: newRefreshToken, user: refreshedUser } = data.data;
            setSession(refreshedUser, newAccessToken, newRefreshToken);
          })
          .catch(() => {
            // Refresh token expired/revoked — the persisted session is stale.
            clearSession();
          });
      }
    }

    bootstrapPromise.finally(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
