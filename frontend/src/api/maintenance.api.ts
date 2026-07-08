import { api } from "./axios";

export const maintenanceApi = {
  list: (params?: Record<string, string>) => api.get("/maintenance", { params }).then((r) => r.data.data),
  get: (id: string) => api.get(`/maintenance/${id}`).then((r) => r.data.data),
  create: (payload: any) => api.post("/maintenance", payload).then((r) => r.data.data),
  update: (id: string, payload: any) => api.patch(`/maintenance/${id}`, payload).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/maintenance/${id}`).then((r) => r.data.data),

  listAssets: (params?: Record<string, string>) => api.get("/maintenance/assets/list", { params }).then((r) => r.data.data),
  getAsset: (id: string) => api.get(`/maintenance/assets/${id}`).then((r) => r.data.data),
  createAsset: (payload: any) => api.post("/maintenance/assets", payload).then((r) => r.data.data),
  updateAsset: (id: string, payload: any) => api.patch(`/maintenance/assets/${id}`, payload).then((r) => r.data.data),
  deleteAsset: (id: string) => api.delete(`/maintenance/assets/${id}`).then((r) => r.data.data),
};
