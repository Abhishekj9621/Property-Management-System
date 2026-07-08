import { api } from "./axios";

export const expenseBudgetsApi = {
  list: (params?: Record<string, string | number>) => api.get("/expenses/budgets", { params }).then((r) => r.data.data),
  create: (payload: any) => api.post("/expenses/budgets", payload).then((r) => r.data.data),
  update: (id: string, payload: any) => api.patch(`/expenses/budgets/${id}`, payload).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/expenses/budgets/${id}`).then((r) => r.data.data),
};
