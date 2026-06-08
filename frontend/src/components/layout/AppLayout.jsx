import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  CalendarCheck,
  Camera,
  ClipboardList,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  UserPlus,
  Users,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { hasAnyRole, useAuth } from "@/context/auth-context";
import { PendingTasksBell } from "@/components/layout/PendingTasksBell";

const getNavItems = (user) => [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Users, label: "Clients", path: "/clients" },
  { icon: UserPlus, label: "Leads", path: "/leads" },
  { icon: Utensils, label: "Diet Plans", path: "/diet-plans" },
  { icon: MessageCircle, label: "Chat", path: "/chat" },
  { icon: Camera, label: "Meal Reviews", path: "/meal-reviews" },
  { icon: CalendarCheck, label: "Follow-ups", path: "/follow-ups" },
  ...(hasAnyRole(user, ["super_admin", "admin"]) ? [{ icon: DollarSign, label: "Finance", path: "/finance" }] : []),
  { icon: ClipboardList, label: "Audit Logs", path: "/audit-logs" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

function useLogout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return () => {
    logout();
    navigate("/login");
    toast.success("Logged out successfully");
  };
}

function IconSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const handleLogout = useLogout();
  const navItems = getNavItems(user);

  return (
    <aside className="group/sidebar sticky top-0 z-50 flex h-screen w-14 flex-col overflow-hidden border-r border-[#241A78] bg-[#18115E] py-3 transition-[width] duration-200 ease-out hover:w-64">
      <div className="mb-3 flex h-9 items-center gap-3 px-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary">
          <Activity className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="whitespace-nowrap font-['Sora'] text-sm font-semibold text-violet-100 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
          NutriTrack Pro
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              className={`flex h-9 items-center gap-3 rounded-lg px-2.5 transition-colors ${
                isActive
                  ? "bg-primary/45 text-violet-100"
                  : "text-violet-300 hover:bg-primary/25 hover:text-violet-100"
              }`}
              aria-label={item.label}
              title={item.label}
            >
              <item.icon className="h-[17px] w-[17px] shrink-0" />
              <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 px-2.5">
        <div className="flex h-9 items-center gap-3 px-0.5">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {user?.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 truncate text-sm font-medium text-violet-100 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
            {user?.name || "User"}
          </span>
        </div>
        <Button
          variant="ghost"
          data-testid="logout-btn"
          onClick={handleLogout}
          className="h-9 justify-start gap-3 px-2.5 text-violet-300 hover:bg-red-500/15 hover:text-red-100"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">Logout</span>
        </Button>
      </div>
    </aside>
  );
}

function MobileSidebar({ onClose }) {
  const { user } = useAuth();
  const location = useLocation();
  const handleLogout = useLogout();
  const navItems = getNavItems(user);

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-[#241A78] bg-[#18115E] p-3 text-violet-100">
      <div className="mb-4 flex items-center gap-3 px-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary">
          <Activity className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="truncate font-['Sora'] text-sm font-semibold">NutriTrack Pro</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive ? "bg-primary/45 text-white" : "text-violet-300 hover:bg-primary/25 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 pt-3">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-2 text-violet-300 hover:bg-red-500/15 hover:text-red-100"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}

export function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <IconSidebar />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <MobileSidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-[52px] items-center gap-4 border-b border-border bg-card px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            data-testid="sidebar-toggle"
            onClick={() => setMobileOpen(true)}
            className="shrink-0 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Menu className="hidden h-4 w-4 text-muted-foreground md:block" />
            <span className="font-['Sora'] text-sm font-semibold text-[#18115E] dark:text-violet-100">NutriTrack Pro</span>
          </div>
          <div className="flex-1" />
          <PendingTasksBell />
        </header>

        <main className="flex-1 p-4 md:p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
