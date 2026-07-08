import { api } from "./axios";
import type { Hotel, WebsiteListing } from "../types";

export const hotelsApi = {
  list: (params?: { status?: "active" | "inactive" | "all"; search?: string }): Promise<Hotel[]> =>
    api.get("/hotels", { params }).then((r) => r.data.data),
  get: (id: string): Promise<Hotel> => api.get(`/hotels/${id}`).then((r) => r.data.data),
  create: (payload: Partial<Hotel> & { reactivateIfInactive?: boolean }): Promise<Hotel> =>
    api.post("/hotels", payload).then((r) => r.data.data),
  update: (id: string, payload: Partial<Hotel>): Promise<Hotel> =>
    api.patch(`/hotels/${id}`, payload).then((r) => r.data.data),
  delete: (id: string): Promise<Hotel> => api.delete(`/hotels/${id}`).then((r) => r.data.data),
  restore: (id: string): Promise<Hotel> => api.post(`/hotels/${id}/restore`).then((r) => r.data.data),
  permanentlyDelete: (id: string): Promise<{ id: string }> =>
    api.delete(`/hotels/${id}/permanent`).then((r) => r.data.data),
};

// Public curatdconcepts.com listing management for a hotel.
export const websiteListingApi = {
  get: (hotelId: string): Promise<WebsiteListing> =>
    api.get(`/hotels/${hotelId}/website-listing`).then((r) => r.data.data),
  upsert: (hotelId: string, payload: Partial<WebsiteListing>): Promise<WebsiteListing> =>
    api.put(`/hotels/${hotelId}/website-listing`, payload).then((r) => r.data.data),
};

export const hotelTypesApi = {
  list: (includeInactive = false) =>
    api.get("/hotel-types", { params: { includeInactive: String(includeInactive) } }).then((r) => r.data.data),
  create: (payload: any) => api.post("/hotel-types", payload).then((r) => r.data.data),
  update: (id: string, payload: any) => api.patch(`/hotel-types/${id}`, payload).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/hotel-types/${id}`).then((r) => r.data.data),
};

export const roomCategoriesApi = {
  list: (includeInactive = false) =>
    api.get("/room-categories", { params: { includeInactive: String(includeInactive) } }).then((r) => r.data.data),
  create: (payload: any) => api.post("/room-categories", payload).then((r) => r.data.data),
  update: (id: string, payload: any) => api.patch(`/room-categories/${id}`, payload).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/room-categories/${id}`).then((r) => r.data.data),
};
