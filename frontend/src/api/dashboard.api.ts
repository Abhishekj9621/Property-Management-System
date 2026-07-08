import { api } from "./axios";

export const dashboardApi = {
  overview: () => api.get("/dashboard/overview").then((r) => r.data.data),
  upcoming: () => api.get("/dashboard/upcoming").then((r) => r.data.data),
};
