import { api } from "./axios";

export const periodCloseApi = {
  list: (params?: Record<string, string | number>) => api.get("/financial/period-close", { params }).then((r) => r.data),
  preview: (businessDate: string) => api.get("/financial/period-close/preview", { params: { businessDate } }).then((r) => r.data.data),
  close: (payload: { businessDate: string; notes?: string }) => api.post("/financial/period-close/close", payload).then((r) => r.data.data),
  reopen: (id: string, reason: string) => api.post(`/financial/period-close/${id}/reopen`, { reason }).then((r) => r.data.data),
};
