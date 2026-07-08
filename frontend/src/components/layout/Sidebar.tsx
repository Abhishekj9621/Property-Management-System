import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  BedDouble,
  CalendarCheck,
  Users,
  Sparkles,
  Hotel,
  LogOut,
  DollarSign,
  Building2,
  UserCog,
  Settings,
  Wrench,
  Receipt,
  ShieldCheck,
  ScrollText,
  FileText,
  RotateCcw,
  Percent,
  BookOpen,
  Moon,
  BarChart3,
  Wallet,
  ChevronDown,
  Truck,
  PiggyBank,
  Repeat,
  PieChart,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { authApi } from "../../api/auth.api";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import type { Role } from "../../types";
import { HotelSwitcher } from "./HotelSwitcher";
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
  ALL_ROLES,
  FINANCE_STAFF,
  FINANCE_MANAGERS,
} from "../../lib/permissions";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
}

interface NavGroup {
  key: string;
  label: string;
  icon: typeof LayoutDashboard;
  basePath: string;
  children: NavItem[];
}

// Every nav item declares who's allowed to see it, matching the backend's
// authorize() checks on the equivalent routes — so no one is ever shown a
// link that will 403 when clicked.
const navItemsBeforeGroups: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: DASHBOARD_VIEWERS },
  { to: "/rooms", label: "Rooms", icon: BedDouble, roles: ROOM_VIEWERS },
  { to: "/bookings", label: "Bookings", icon: CalendarCheck, roles: [...MANAGE, "RECEPTIONIST"] },
  { to: "/guests", label: "Guests", icon: Users, roles: [...MANAGE, "RECEPTIONIST"] },
  { to: "/housekeeping", label: "Housekeeping", icon: Sparkles, roles: HOUSEKEEPING_VIEWERS },
  { to: "/maintenance", label: "Maintenance", icon: Wrench, roles: MAINTENANCE_VIEWERS },
  { to: "/revenue", label: "Revenue", icon: DollarSign, roles: REVENUE_VIEWERS },
];

// Every collapsible module lives here — one nav entry that expands into
// its sub-pages, instead of cluttering the top-level nav with a link per
// page. Add a new module by adding a new entry to this array.
const navGroups: NavGroup[] = [
  {
    key: "expenses",
    label: "Expense Management",
    icon: Receipt,
    basePath: "/expenses",
    children: [
      { to: "/expenses", label: "Expenses & Claims", icon: Receipt, roles: EXPENSE_VIEWERS },
      { to: "/expenses/vendors", label: "Vendors", icon: Truck, roles: EXPENSE_MANAGERS },
      { to: "/expenses/budgets", label: "Budgets", icon: PiggyBank, roles: EXPENSE_MANAGERS },
      { to: "/expenses/recurring", label: "Recurring Expenses", icon: Repeat, roles: EXPENSE_MANAGERS },
      { to: "/expenses/reports", label: "Expense Reports", icon: PieChart, roles: EXPENSE_MANAGERS },
    ],
  },
  {
    key: "financial",
    label: "Financial Management",
    icon: Wallet,
    basePath: "/financial",
    children: [
      { to: "/financial/invoices", label: "Invoices", icon: FileText, roles: FINANCE_STAFF },
      { to: "/financial/refunds", label: "Refunds", icon: RotateCcw, roles: FINANCE_STAFF },
      { to: "/financial/tax-rates", label: "Tax Rates", icon: Percent, roles: FINANCE_MANAGERS },
      { to: "/financial/ledger", label: "Ledger", icon: BookOpen, roles: FINANCE_MANAGERS },
      { to: "/financial/period-close", label: "Day-End Close", icon: Moon, roles: FINANCE_MANAGERS },
      { to: "/financial/reports", label: "Financial Reports", icon: BarChart3, roles: FINANCE_MANAGERS },
    ],
  },
];

const navItemsAfterGroups: NavItem[] = [
  { to: "/hotels", label: "Hotels", icon: Building2, roles: HOTEL_MANAGERS },
  { to: "/team", label: "Team", icon: UserCog, roles: USER_MANAGERS },
  { to: "/audit-logs", label: "Audit Log", icon: ScrollText, roles: AUDIT_LOG_VIEWERS },
  { to: "/settings", label: "Settings", icon: Settings, roles: SETTINGS_MANAGERS },
  { to: "/security", label: "Security", icon: ShieldCheck, roles: ALL_ROLES },
];

function NavLinkItem({ to, label, icon: Icon, indent = false }: { to: string; label: string; icon: typeof LayoutDashboard; indent?: boolean }) {
  return (
    <NavLink
      to={to}
      end={indent}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors",
          indent ? "pl-11 pr-3" : "px-3",
          isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        )
      }
    >
      {!indent && <Icon className="h-4 w-4" />}
      {indent && <Icon className="h-3.5 w-3.5" />}
      {label}
    </NavLink>
  );
}

export function Sidebar() {
  const { user, refreshToken, clearSession } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Any group whose basePath matches the current route starts expanded, so
  // landing directly on e.g. /expenses/vendors doesn't hide its own nav.
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(navGroups.filter((g) => location.pathname.startsWith(g.basePath)).map((g) => g.key))
  );

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } finally {
      clearSession();
      navigate("/login");
    }
  };

  const visibleBeforeItems = navItemsBeforeGroups.filter((item) => user && item.roles.includes(user.role));
  const visibleAfterItems = navItemsAfterGroups.filter((item) => user && item.roles.includes(user.role));

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-6 py-5">
        <Hotel className="h-6 w-6 text-brand-600" />
        <span className="text-lg font-bold text-gray-900">NovaStay</span>
      </div>

      {/* SUPER_ADMIN isn't pinned to one property, so they get a switcher.
          Everyone else already has a fixed hotel from their account. */}
      {user?.role === "SUPER_ADMIN" && <HotelSwitcher />}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-2">
        {visibleBeforeItems.map(({ to, label, icon }) => (
          <NavLinkItem key={to} to={to} label={label} icon={icon} />
        ))}

        {navGroups.map((group) => {
          const visibleChildren = group.children.filter((item) => user && item.roles.includes(user.role));
          if (visibleChildren.length === 0) return null;
          const isOpen = openGroups.has(group.key);
          const isGroupActive = location.pathname.startsWith(group.basePath);

          return (
            <div key={group.key}>
              <button
                onClick={() => toggleGroup(group.key)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isGroupActive ? "text-brand-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <group.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-100">
                  {visibleChildren.map(({ to, label, icon }) => (
                    <NavLinkItem key={to} to={to} label={label} icon={icon} indent />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {visibleAfterItems.map(({ to, label, icon }) => (
          <NavLinkItem key={to} to={to} label={label} icon={icon} />
        ))}
      </nav>

      <div className="border-t border-gray-200 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-xs text-gray-500">{user?.role.replace(/_/g, " ")}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
