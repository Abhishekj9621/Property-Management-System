import { api } from "./axios";

export const invoicesApi = {
  list: (params?: Record<string, string | number>) => api.get("/financial/invoices", { params }).then((r) => r.data),
  get: (id: string) => api.get(`/financial/invoices/${id}`).then((r) => r.data.data),
  create: (payload: any) => api.post("/financial/invoices", payload).then((r) => r.data.data),
  updateDraft: (id: string, payload: any) => api.patch(`/financial/invoices/${id}`, payload).then((r) => r.data.data),
  issue: (id: string) => api.post(`/financial/invoices/${id}/issue`).then((r) => r.data.data),
  void: (id: string, reason: string) => api.post(`/financial/invoices/${id}/void`, { reason }).then((r) => r.data.data),
  markPaid: (id: string) => api.post(`/financial/invoices/${id}/mark-paid`).then((r) => r.data.data),
};
