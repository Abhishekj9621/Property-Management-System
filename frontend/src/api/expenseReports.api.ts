import { api } from "./axios";

export const expenseReportsApi = {
  summary: (params?: { from?: string; to?: string }) => api.get("/expenses/reports/summary", { params }).then((r) => r.data.data),
  byCategory: (params?: { from?: string; to?: string }) => api.get("/expenses/reports/by-category", { params }).then((r) => r.data.data),
  byVendor: (params?: { from?: string; to?: string }) => api.get("/expenses/reports/by-vendor", { params }).then((r) => r.data.data),
  monthlyTrend: (months = 6) => api.get("/expenses/reports/monthly-trend", { params: { months } }).then((r) => r.data.data),
  exportCsv: async (endpoint: "by-category" | "by-vendor", filename: string, params?: Record<string, string>) => {
    const res = await api.get(`/expenses/reports/${endpoint}.csv`, { params, responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
