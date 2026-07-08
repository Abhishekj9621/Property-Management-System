import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";
import { useHotelStore } from "../store/hotelStore";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Tells the API which hotel this request is scoped to. Hotel-scoped staff
  // (HOTEL_ADMIN/MANAGER/RECEPTIONIST/HOUSEKEEPING) already carry their
  // hotelId in the JWT, so this mainly matters for SUPER_ADMIN, whose token
  // has no fixed hotel and who picks one via the hotel switcher.
  const selectedHotelId = useHotelStore.getState().selectedHotelId;
  if (selectedHotelId) config.headers["x-hotel-id"] = selectedHotelId;

  return config;
});

let isRefreshing = false;
let pendingQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes("/auth/")) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingQueue.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken, user } = data.data;

        useAuthStore.getState().setSession(user, accessToken, newRefreshToken);
        pendingQueue.forEach((cb) => cb(accessToken));
        pendingQueue = [];

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().clearSession();
        // Raw browser navigation (not React Router), so it needs the base
        // path prepended manually — BASE_URL is "/" normally (→ "/login")
        // or "/admin/" for the combined local-server setup (→ "/admin/login").
        window.location.href = `${import.meta.env.BASE_URL}login`.replace(/\/{2,}/g, "/");
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
