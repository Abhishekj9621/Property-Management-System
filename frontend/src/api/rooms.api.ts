import { api } from "./axios";

export const roomsApi = {
  listRooms: (params?: Record<string, string>) => api.get("/rooms", { params }).then((r) => r.data.data),
  listRoomTypes: (includeInactive = false) =>
    api.get("/rooms/types", { params: { includeInactive: String(includeInactive) } }).then((r) => r.data.data),
  createRoomType: (payload: any) => api.post("/rooms/types", payload).then((r) => r.data.data),
  updateRoomType: (id: string, payload: any) => api.patch(`/rooms/types/${id}`, payload).then((r) => r.data.data),
  deleteRoomType: (id: string) => api.delete(`/rooms/types/${id}`).then((r) => r.data.data),
  createRoom: (payload: any) => api.post("/rooms", payload).then((r) => r.data.data),
  bulkCreateRooms: (payload: {
    roomTypeId: string;
    floor: number;
    startNumber: number;
    count: number;
    prefix?: string;
    view?: string;
    smokingAllowed?: boolean;
  }) => api.post("/rooms/bulk", payload).then((r) => r.data.data),
  listFloors: () => api.get("/rooms/floors").then((r) => r.data.data),
  updateRoom: (id: string, payload: any) => api.patch(`/rooms/${id}`, payload).then((r) => r.data.data),
  deleteRoom: (id: string) => api.delete(`/rooms/${id}`).then((r) => r.data.data),
  updateStatus: (id: string, status: string) => api.patch(`/rooms/${id}/status`, { status }).then((r) => r.data.data),
  searchAvailability: (checkInDate: string, checkOutDate: string, adults = 1) =>
    api.get("/rooms/availability", { params: { checkInDate, checkOutDate, adults } }).then((r) => r.data.data),
};
