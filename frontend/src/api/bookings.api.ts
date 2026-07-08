import { api } from "./axios";

export const bookingsApi = {
  list: (params?: Record<string, string>) => api.get("/bookings", { params }).then((r) => r.data),
  get: (id: string) => api.get(`/bookings/${id}`).then((r) => r.data.data),
  create: (payload: any) => api.post("/bookings", payload).then((r) => r.data.data),
  updateStatus: (id: string, status: string, cancellationReason?: string) =>
    api.patch(`/bookings/${id}/status`, { status, cancellationReason }).then((r) => r.data.data),
  amend: (
    id: string,
    payload: {
      checkInDate?: string;
      checkOutDate?: string;
      roomIds?: string[];
      adults?: number;
      children?: number;
      specialRequests?: string;
      discountAmount?: number;
    }
  ) => api.patch(`/bookings/${id}/amend`, payload).then((r) => r.data.data),
  checkIn: (id: string) => api.post(`/bookings/${id}/check-in`).then((r) => r.data.data),
  checkOut: (id: string) => api.post(`/bookings/${id}/check-out`).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/bookings/${id}`).then((r) => r.data.data),
};
