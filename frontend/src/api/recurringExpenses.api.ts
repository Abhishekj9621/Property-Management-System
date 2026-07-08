import { api } from "./axios";

export const recurringExpensesApi = {
  list: (includeInactive = false) => api.get("/expenses/recurring", { params: { includeInactive } }).then((r) => r.data.data),
  get: (id: string) => api.get(`/expenses/recurring/${id}`).then((r) => r.data.data),
  create: (payload: any) => api.post("/expenses/recurring", payload).then((r) => r.data.data),
  update: (id: string, payload: any) => api.patch(`/expenses/recurring/${id}`, payload).then((r) => r.data.data),
  pause: (id: string) => api.post(`/expenses/recurring/${id}/pause`).then((r) => r.data.data),
  resume: (id: string) => api.post(`/expenses/recurring/${id}/resume`).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/expenses/recurring/${id}`).then((r) => r.data.data),
};
