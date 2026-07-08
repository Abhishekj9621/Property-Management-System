import { api } from "./axios";
import type { StaffUser } from "../types";

export const usersApi = {
  list: (params?: { hotelId?: string; role?: string; includeInactive?: boolean; search?: string }): Promise<StaffUser[]> =>
    api
      .get("/users", { params: { ...params, includeInactive: params?.includeInactive ? "true" : undefined } })
      .then((r) => r.data.data),
  get: (id: string): Promise<StaffUser> => api.get(`/users/${id}`).then((r) => r.data.data),
  create: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: string;
    hotelId?: string;
  }): Promise<StaffUser> => api.post("/users", payload).then((r) => r.data.data),
  update: (id: string, payload: Partial<StaffUser> & { role?: string }): Promise<StaffUser> =>
    api.patch(`/users/${id}`, payload).then((r) => r.data.data),
  resetPassword: (id: string, newPassword: string) =>
    api.post(`/users/${id}/reset-password`, { newPassword }).then((r) => r.data.data),
  deactivate: (id: string) => api.delete(`/users/${id}`).then((r) => r.data.data),
  restore: (id: string) => api.post(`/users/${id}/restore`).then((r) => r.data.data),
};
