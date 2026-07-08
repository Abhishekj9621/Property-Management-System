import { api } from "./axios";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  list: (params?: { unreadOnly?: boolean; page?: number; limit?: number }) =>
    api.get("/notifications", { params }).then((r) => r.data.data as {
      items: AppNotification[];
      total: number;
      unreadCount: number;
      page: number;
      limit: number;
      totalPages: number;
    }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data.data),
  markAllRead: () => api.patch("/notifications/read-all").then((r) => r.data.data),
  remove: (id: string) => api.delete(`/notifications/${id}`).then((r) => r.data.data),
};
