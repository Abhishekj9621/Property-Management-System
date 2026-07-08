import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import type { Role } from "../../types";

interface ProtectedRouteProps {
  /** If provided, only these roles may access the nested routes. */
  roles?: Role[];
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
