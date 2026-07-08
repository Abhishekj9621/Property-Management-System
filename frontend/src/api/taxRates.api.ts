import { api } from "./axios";

export const taxRatesApi = {
  list: (includeInactive = false) => api.get("/financial/tax-rates", { params: { includeInactive } }).then((r) => r.data.data),
  create: (payload: { name: string; code?: string; percentage: number; isDefault?: boolean }) =>
    api.post("/financial/tax-rates", payload).then((r) => r.data.data),
  update: (id: string, payload: any) => api.patch(`/financial/tax-rates/${id}`, payload).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/financial/tax-rates/${id}`).then((r) => r.data.data),
};
