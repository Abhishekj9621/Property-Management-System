import { api } from "./axios";

export const creditNotesApi = {
  list: (params?: Record<string, string | number>) => api.get("/financial/credit-notes", { params }).then((r) => r.data),
  get: (id: string) => api.get(`/financial/credit-notes/${id}`).then((r) => r.data.data),
  create: (payload: { invoiceId: string; amount: number; reason: string }) => api.post("/financial/credit-notes", payload).then((r) => r.data.data),
  void: (id: string) => api.post(`/financial/credit-notes/${id}/void`).then((r) => r.data.data),
};
