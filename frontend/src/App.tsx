import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/common/ProtectedRoute";
import { useSessionBootstrap } from "./hooks/useSessionBootstrap";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Forbidden from "./pages/Forbidden";
import NotFound from "./pages/NotFound";
import { useAuthStore } from "./store/authStore";
import {
  MANAGE,
  REVENUE_VIEWERS,
  HOTEL_MANAGERS,
  DASHBOARD_VIEWERS,
  ROOM_VIEWERS,
  HOUSEKEEPING_VIEWERS,
  MAINTENANCE_VIEWERS,
  EXPENSE_VIEWERS,
  EXPENSE_MANAGERS,
  USER_MANAGERS,
  SETTINGS_MANAGERS,
  AUDIT_LOG_VIEWERS,
  FINANCE_STAFF,
  FINANCE_MANAGERS,
} from "./lib/permissions";

// Every dashboard/feature page is code-split — none of it is needed for the
// first paint of the login screen, and together they'd previously all
// landed in one >1MB JS chunk (Vite's build warns above that threshold).
// Splitting per-page means a receptionist who never opens Financial
// Management never downloads its charts/tables code at all.
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const RoomsPage = lazy(() => import("./pages/rooms/RoomsPage"));
const BookingsPage = lazy(() => import("./pages/bookings/BookingsPage"));
const NewBooking = lazy(() => import("./pages/bookings/NewBooking"));
const GuestsPage = lazy(() => import("./pages/guests/GuestsPage"));
const HousekeepingPage = lazy(() => import("./pages/housekeeping/HousekeepingPage"));
const MaintenancePage = lazy(() => import("./pages/maintenance/MaintenancePage"));
const ExpensesPage = lazy(() => import("./pages/expenses/ExpensesPage"));
const VendorsPage = lazy(() => import("./pages/expenses/VendorsPage"));
const ExpenseBudgetsPage = lazy(() => import("./pages/expenses/ExpenseBudgetsPage"));
const RecurringExpensesPage = lazy(() => import("./pages/expenses/RecurringExpensesPage"));
const ExpenseReportsPage = lazy(() => import("./pages/expenses/ExpenseReportsPage"));
const HotelsPage = lazy(() => import("./pages/hotels/HotelsPage"));
const TeamPage = lazy(() => import("./pages/team/TeamPage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const RevenuePage = lazy(() => import("./pages/revenue/RevenuePage"));
const SecurityPage = lazy(() => import("./pages/security/SecurityPage"));
const AuditLogsPage = lazy(() => import("./pages/audit-logs/AuditLogsPage"));
const InvoicesPage = lazy(() => import("./pages/financial/InvoicesPage"));
const RefundsPage = lazy(() => import("./pages/financial/RefundsPage"));
const TaxRatesPage = lazy(() => import("./pages/financial/TaxRatesPage"));
const LedgerPage = lazy(() => import("./pages/financial/LedgerPage"));
const PeriodClosePage = lazy(() => import("./pages/financial/PeriodClosePage"));
const FinancialReportsPage = lazy(() => import("./pages/financial/FinancialReportsPage"));

function PageLoading() {
  return <div className="flex h-64 items-center justify-center text-sm text-gray-400">Loading…</div>;
}

/** Sends the user to the first page their role can actually see, instead of
 * always assuming /dashboard — which Housekeeping, for example, can't view. */
function RoleHome() {
  const { user } = useAuthStore();
  if (user && DASHBOARD_VIEWERS.includes(user.role)) return <Navigate to="/dashboard" replace />;
  if (user && ROOM_VIEWERS.includes(user.role)) return <Navigate to="/rooms" replace />;
  return <Navigate to="/403" replace />;
}

export default function App() {
  const ready = useSessionBootstrap();

  // Only relevant right after a page load/reload with a persisted session:
  // this resolves as soon as the silent refresh (or the decision that
  // there's nothing to refresh) finishes, which is a single fast request,
  // not a lasting loading state.
  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/403" element={<Forbidden />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<RoleHome />} />

          <Route element={<ProtectedRoute roles={DASHBOARD_VIEWERS} />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          <Route element={<ProtectedRoute roles={ROOM_VIEWERS} />}>
            <Route path="/rooms" element={<RoomsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={HOUSEKEEPING_VIEWERS} />}>
            <Route path="/housekeeping" element={<HousekeepingPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={MAINTENANCE_VIEWERS} />}>
            <Route path="/maintenance" element={<MaintenancePage />} />
          </Route>

          <Route element={<ProtectedRoute roles={EXPENSE_VIEWERS} />}>
            <Route path="/expenses" element={<ExpensesPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={EXPENSE_MANAGERS} />}>
            <Route path="/expenses/vendors" element={<VendorsPage />} />
            <Route path="/expenses/budgets" element={<ExpenseBudgetsPage />} />
            <Route path="/expenses/recurring" element={<RecurringExpensesPage />} />
            <Route path="/expenses/reports" element={<ExpenseReportsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={[...MANAGE, "RECEPTIONIST"]} />}>
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/bookings/new" element={<NewBooking />} />
            <Route path="/guests" element={<GuestsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={REVENUE_VIEWERS} />}>
            <Route path="/revenue" element={<RevenuePage />} />
          </Route>

          <Route element={<ProtectedRoute roles={HOTEL_MANAGERS} />}>
            <Route path="/hotels" element={<HotelsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={USER_MANAGERS} />}>
            <Route path="/team" element={<TeamPage />} />
          </Route>

          <Route path="/security" element={<SecurityPage />} />

          <Route element={<ProtectedRoute roles={AUDIT_LOG_VIEWERS} />}>
            <Route path="/audit-logs" element={<AuditLogsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={FINANCE_STAFF} />}>
            <Route path="/financial/invoices" element={<InvoicesPage />} />
            <Route path="/financial/refunds" element={<RefundsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={FINANCE_MANAGERS} />}>
            <Route path="/financial/tax-rates" element={<TaxRatesPage />} />
            <Route path="/financial/ledger" element={<LedgerPage />} />
            <Route path="/financial/period-close" element={<PeriodClosePage />} />
            <Route path="/financial/reports" element={<FinancialReportsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={SETTINGS_MANAGERS} />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}
