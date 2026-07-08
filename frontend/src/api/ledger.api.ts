import { api } from "./axios";

export const ledgerApi = {
  list: (params?: Record<string, string | number>) => api.get("/financial/ledger", { params }).then((r) => r.data),
  createManualEntry: (payload: { type: string; direction: string; amount: number; description: string; entryDate?: string }) =>
    api.post("/financial/ledger/manual-entries", payload).then((r) => r.data.data),
};
