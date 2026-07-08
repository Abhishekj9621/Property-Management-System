import { api } from "./axios";

export const paymentsApi = {
  listForHotel: (params?: { from?: string; to?: string; page?: number; limit?: number }) =>
    api.get("/payments", { params }).then((r) => ({ items: r.data.data, meta: r.data.meta })),
  listForBooking: (bookingId: string) => api.get(`/payments/booking/${bookingId}`).then((r) => r.data.data),
  recordPayment: (payload: { bookingId: string; amount: number; method: string }) =>
    api.post("/payments", payload).then((r) => r.data.data),
};
