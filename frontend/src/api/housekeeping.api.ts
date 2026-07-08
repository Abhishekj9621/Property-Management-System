import { api } from "./axios";

export const housekeepingApi = {
  list: (params?: Record<string, string>) => api.get("/housekeeping", { params }).then((r) => r.data.data),
  create: (payload: any) => api.post("/housekeeping", payload).then((r) => r.data.data),
  update: (id: string, payload: any) => api.patch(`/housekeeping/${id}`, payload).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/housekeeping/${id}`).then((r) => r.data.data),
};
