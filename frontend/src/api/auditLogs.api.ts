import { api } from "./axios";

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: string } | null;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const auditLogsApi = {
  list: (params: { page?: number; pageSize?: number; action?: string; entity?: string } = {}) =>
    api.get<{ data: AuditLogPage }>("/audit-logs", { params }).then((r) => r.data.data),
};
