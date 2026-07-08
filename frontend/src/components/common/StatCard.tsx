import { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  accent?: string;
}

export function StatCard({ label, value, icon: Icon, accent = "brand" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`rounded-lg bg-${accent}-50 p-2`}>
          <Icon className={`h-4 w-4 text-${accent}-600`} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
