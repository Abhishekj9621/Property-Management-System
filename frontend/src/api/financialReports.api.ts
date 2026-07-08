import { api } from "./axios";

export const financialReportsApi = {
  profitAndLoss: (params?: { from?: string; to?: string }) => api.get("/financial/reports/profit-and-loss", { params }).then((r) => r.data.data),
  arAging: () => api.get("/financial/reports/ar-aging").then((r) => r.data.data),
  dailyCash: (date: string) => api.get("/financial/reports/daily-cash", { params: { date } }).then((r) => r.data.data),
  consolidated: (params?: { from?: string; to?: string }) => api.get("/financial/reports/consolidated", { params }).then((r) => r.data.data),
  exportCsv: async (endpoint: "profit-and-loss" | "ar-aging", filename: string, params?: Record<string, string>) => {
    const res = await api.get(`/financial/reports/${endpoint}.csv`, { params, responseType: "blob" });
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
