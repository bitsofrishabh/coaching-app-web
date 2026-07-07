import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Users, LayoutDashboard, Utensils, DollarSign, CalendarCheck, Settings,
  LogOut, Menu, MessageCircle, Camera, Activity, UserPlus, ScrollText, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/context/auth-context";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Users, label: "Clients", path: "/clients" },
  { icon: UserPlus, label: "Leads", path: "/leads" },
  { icon: Utensils, label: "Diet Plans", path: "/diet-plans" },
  { icon: MessageCircle, label: "Chat", path: "/chat", badge: true },
  { icon: Camera, label: "Meal Reviews", path: "/meal-reviews" },
  { icon: CalendarCheck, label: "Follow-ups", path: "/follow-ups" },
  { icon: DollarSign, label: "Finance", path: "/finance" },
  { icon: ScrollText, label: "Audit Logs", path: "/audit-logs" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

function Sidebar({ collapsed, onNavigate }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
    toast.success("Logged out");
  };

  return (
    <aside
      className={`${collapsed ? "w-20" : "w-64"} bg-sidebar text-sidebar-foreground h-screen sticky top-0 flex flex-col transition-all duration-300`}
    >
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
          <Activity className="h-5 w-5 text-sidebar-foreground" />
        </div>
        {!collapsed && (
          <span className="truncate font-display text-lg font-bold tracking-tight text-sidebar-foreground">
            NutriTrack Pro
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              data-testid={`nav-${item.label.toLowerCase().replace(/ /g, "-")}`}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-white/[0.14] font-semibold text-sidebar-foreground"
                  : "text-sidebar-muted hover:bg-white/[0.08] hover:text-sidebar-foreground"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-lime-400" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-white/15 text-sm font-semibold text-sidebar-foreground">
              {user?.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.name}</p>
              <p className="truncate text-xs text-sidebar-muted">{user?.email}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            data-testid="logout-btn"
            onClick={handleLogout}
            className="shrink-0 text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

export function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-card px-4">
          <Button
            variant="ghost"
            size="icon"
            data-testid="sidebar-toggle"
            onClick={() => (window.innerWidth < 768 ? setMobileOpen(true) : setCollapsed(!collapsed))}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-display text-base font-semibold tracking-tight text-foreground">
            NutriTrack Pro
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="relative shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
