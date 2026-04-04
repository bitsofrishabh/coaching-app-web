import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Users, LayoutDashboard, Utensils, DollarSign, CalendarCheck, Settings,
  LogOut, Menu, MessageCircle, Camera, Activity, ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { hasAnyRole, useAuth } from "@/context/auth-context";
import { PendingTasksBell } from "@/components/layout/PendingTasksBell";

function Sidebar({ collapsed, setCollapsed }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Users, label: "Clients", path: "/clients" },
    { icon: Utensils, label: "Diet Plans", path: "/diet-plans" },
    { icon: MessageCircle, label: "Chat", path: "/chat", badge: true },
    { icon: Camera, label: "Meal Reviews", path: "/meal-reviews" },
    { icon: CalendarCheck, label: "Follow-ups", path: "/follow-ups" },
    ...(hasAnyRole(user, ["super_admin", "admin"]) ? [{ icon: DollarSign, label: "Finance", path: "/finance" }] : []),
    { icon: ClipboardList, label: "Audit Logs", path: "/audit-logs" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
    toast.success("Logged out successfully");
  };

  return (
    <aside className={`${collapsed ? "w-20" : "w-64"} border-r border-border bg-card/50 backdrop-blur-xl h-screen sticky top-0 flex flex-col transition-all duration-300`}>
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold font-['Manrope'] text-foreground truncate">DietTracker</span>
          )}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-primary" : ""}`} />
              {!collapsed && <span className="font-medium truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border/50">
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
              {user?.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            data-testid="logout-btn"
            onClick={handleLogout}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
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
    <div className="min-h-screen bg-background flex">
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar collapsed={false} setCollapsed={() => {}} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border/50 glass sticky top-0 z-40 flex items-center px-4 gap-4">
          <Button
            variant="ghost"
            size="icon"
            data-testid="sidebar-toggle"
            onClick={() => window.innerWidth < 768 ? setMobileOpen(true) : setCollapsed(!collapsed)}
            className="shrink-0"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
          <PendingTasksBell />
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
