import { api } from "./axios";

export const expensesApi = {
  list: (params?: Record<string, string>) => api.get("/expenses", { params }).then((r) => r.data),
  get: (id: string) => api.get(`/expenses/${id}`).then((r) => r.data.data),
  create: (payload: any) => api.post("/expenses", payload).then((r) => r.data.data),
  update: (id: string, payload: any) => api.patch(`/expenses/${id}`, payload).then((r) => r.data.data),
  decide: (id: string, payload: { status: string; rejectionReason?: string; paymentMethod?: string; paymentReference?: string }) =>
    api.post(`/expenses/${id}/decision`, payload).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/expenses/${id}`).then((r) => r.data.data),
  addAttachment: (id: string, payload: { url: string; fileName?: string }) => api.post(`/expenses/${id}/attachments`, payload).then((r) => r.data.data),
  removeAttachment: (id: string, attachmentId: string) => api.delete(`/expenses/${id}/attachments/${attachmentId}`).then((r) => r.data.data),

  listCategories: (includeInactive = false) => api.get("/expenses/categories", { params: { includeInactive } }).then((r) => r.data.data),
  createCategory: (payload: { name: string; code?: string }) => api.post("/expenses/categories", payload).then((r) => r.data.data),
  updateCategory: (id: string, payload: any) => api.patch(`/expenses/categories/${id}`, payload).then((r) => r.data.data),
};
