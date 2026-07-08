import { api } from "./axios";

export const vendorsApi = {
  list: (includeInactive = false) => api.get("/expenses/vendors", { params: { includeInactive } }).then((r) => r.data.data),
  get: (id: string) => api.get(`/expenses/vendors/${id}`).then((r) => r.data.data),
  spendSummary: (id: string) => api.get(`/expenses/vendors/${id}/spend-summary`).then((r) => r.data.data),
  create: (payload: any) => api.post("/expenses/vendors", payload).then((r) => r.data.data),
  update: (id: string, payload: any) => api.patch(`/expenses/vendors/${id}`, payload).then((r) => r.data.data),
  deactivate: (id: string) => api.delete(`/expenses/vendors/${id}`).then((r) => r.data.data),
};
