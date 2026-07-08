import { api } from "./axios";

export const guestsApi = {
  list: (search?: string) => api.get("/guests", { params: { search } }).then((r) => r.data.data),
  get: (id: string) => api.get(`/guests/${id}`).then((r) => r.data.data),
  create: (payload: any) => api.post("/guests", payload).then((r) => r.data.data),
  update: (id: string, payload: any) => api.patch(`/guests/${id}`, payload).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/guests/${id}`).then((r) => r.data.data),
};
