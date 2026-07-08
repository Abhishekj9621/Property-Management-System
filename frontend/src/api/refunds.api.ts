import { api } from "./axios";

export const refundsApi = {
  list: (params?: Record<string, string | number>) => api.get("/financial/refunds", { params }).then((r) => r.data),
  get: (id: string) => api.get(`/financial/refunds/${id}`).then((r) => r.data.data),
  create: (payload: { bookingId: string; paymentId?: string; amount: number; reason: string; method: string }) =>
    api.post("/financial/refunds", payload).then((r) => r.data.data),
  decide: (id: string, payload: { status: "APPROVED" | "REJECTED"; rejectionReason?: string }) =>
    api.post(`/financial/refunds/${id}/decision`, payload).then((r) => r.data.data),
  process: (id: string, transactionRef?: string) => api.post(`/financial/refunds/${id}/process`, { transactionRef }).then((r) => r.data.data),
};
