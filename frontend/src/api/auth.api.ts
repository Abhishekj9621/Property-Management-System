import { api } from "./axios";

export interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export const authApi = {
  login: (email: string, password: string) => api.post("/auth/login", { email, password }).then((r) => r.data.data),
  register: (payload: any) => api.post("/auth/register", payload).then((r) => r.data.data),
  logout: (refreshToken: string) => api.post("/auth/logout", { refreshToken }),
  me: () => api.get("/auth/me").then((r) => r.data.data),
  forgotPassword: (email: string) => api.post("/auth/forgot-password", { email }).then((r) => r.data),
  resetPassword: (token: string, newPassword: string) =>
    api.post("/auth/reset-password", { token, newPassword }).then((r) => r.data),
  listSessions: (currentRefreshToken?: string) =>
    api
      .get<{ data: Session[] }>("/auth/sessions", { params: { currentRefreshToken } })
      .then((r) => r.data.data),
  revokeSession: (id: string) => api.delete(`/auth/sessions/${id}`).then((r) => r.data),
  revokeAllSessions: (exceptRefreshToken?: string) =>
    api.delete("/auth/sessions", { data: { exceptRefreshToken } }).then((r) => r.data),
};
