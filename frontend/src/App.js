import { useState, useEffect, createContext, useContext, useRef, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link, useParams } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import {
  Users, LayoutDashboard, Utensils, DollarSign, CalendarCheck, Settings,
  LogOut, Menu, X, Plus, Search, Filter, ChevronRight, TrendingUp, TrendingDown,
  Scale, Activity, Clock, Eye, Edit, Trash2, MoreHorizontal, User, Phone, Mail,
  Target, Calendar, FileText, CheckCircle, AlertCircle, BarChart3, MessageCircle,
  Image, Send, Camera, Droplets, Smile, Copy, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ============ AUTH PROVIDER ============
function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token && !user) {
      api.get("/auth/me")
        .then((res) => {
          setUser(res.data);
          localStorage.setItem("user", JSON.stringify(res.data));
        })
        .catch(() => {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", res.data.access_token);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await api.post("/auth/register", { name, email, password, role: "coach" });
    localStorage.setItem("token", res.data.access_token);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============ PROTECTED ROUTE ============
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// ============ LOADING SCREEN ============
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse-glow">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <Activity className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
    </div>
  );
}

// ============ LOGIN PAGE ============
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await register(name, email, password);
        toast.success("Account created successfully!");
      } else {
        await login(email, password);
        toast.success("Welcome back!");
      }
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-background to-background items-center justify-center p-12">
        <div className="max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Activity className="w-7 h-7 text-primary-foreground" />
            </div>
            <span className="text-3xl font-bold font-['Manrope'] text-foreground">DietTracker Pro</span>
          </div>
          <h1 className="text-4xl font-bold font-['Manrope'] text-foreground mb-4">
            Manage your clients.<br />
            <span className="text-primary">Grow your practice.</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            The unified platform for dietitians and coaches to manage clients, create diet plans, track progress, and grow revenue.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md border-border/40 bg-card/50 animate-slide-in">
          <CardHeader className="space-y-1 pb-6">
            <div className="lg:hidden flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold font-['Manrope']">DietTracker Pro</span>
            </div>
            <CardTitle className="text-2xl font-bold font-['Manrope']">
              {isRegister ? "Create account" : "Welcome back"}
            </CardTitle>
            <CardDescription>
              {isRegister ? "Start your journey with DietTracker Pro" : "Sign in to your account to continue"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    data-testid="register-name-input"
                    placeholder="Dr. John Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="login-email-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  data-testid="login-password-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <Button
                type="submit"
                data-testid="login-submit-btn"
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 btn-glow font-semibold"
                disabled={loading}
              >
                {loading ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button
                type="button"
                data-testid="toggle-auth-mode"
                onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isRegister ? "Already have an account? Sign in" : "Don't have an account? Create one"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============ SIDEBAR ============
function Sidebar({ collapsed, setCollapsed }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Users, label: "Clients", path: "/clients" },
    { icon: Utensils, label: "Diet Plans", path: "/diet-plans" },
    { icon: CalendarCheck, label: "Follow-ups", path: "/follow-ups" },
    { icon: DollarSign, label: "Finance", path: "/finance" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
    toast.success("Logged out successfully");
  };

  return (
    <aside className={`${collapsed ? "w-20" : "w-64"} border-r border-border bg-card/50 backdrop-blur-xl h-screen sticky top-0 flex flex-col transition-all duration-300`}>
      {/* Logo */}
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

      {/* Navigation */}
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

      {/* User section */}
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

// ============ LAYOUT ============
function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar collapsed={false} setCollapsed={() => {}} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
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
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

// ============ STAT CARD ============
function StatCard({ title, value, change, icon: Icon, trend }) {
  return (
    <Card className="stat-highlight border-border/40 bg-card/50 hover:border-primary/30 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold font-['Manrope'] mt-2">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
                {trend === "up" ? <TrendingUp className="w-4 h-4" /> : trend === "down" ? <TrendingDown className="w-4 h-4" /> : null}
                <span>{change}</span>
              </div>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ DASHBOARD PAGE ============
function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/stats"),
      api.get("/dashboard/recent-activity")
    ]).then(([statsRes, activityRes]) => {
      setStats(statsRes.data);
      setRecentActivity(activityRes.data);
    }).catch((err) => {
      toast.error("Failed to load dashboard");
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;

  const chartData = [
    { name: "Mon", clients: 4, revenue: 2400 },
    { name: "Tue", clients: 3, revenue: 1800 },
    { name: "Wed", clients: 6, revenue: 3200 },
    { name: "Thu", clients: 5, revenue: 2800 },
    { name: "Fri", clients: 8, revenue: 4200 },
    { name: "Sat", clients: 2, revenue: 1200 },
    { name: "Sun", clients: 1, revenue: 800 },
  ];

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-['Manrope']">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your practice overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Clients"
          value={stats?.total_clients || 0}
          change={`${stats?.active_clients || 0} active`}
          icon={Users}
        />
        <StatCard
          title="Monthly Revenue"
          value={`₹${(stats?.monthly_revenue || 0).toLocaleString()}`}
          change="+12% from last month"
          trend="up"
          icon={DollarSign}
        />
        <StatCard
          title="Active Diet Plans"
          value={stats?.active_diet_plans || 0}
          icon={Utensils}
        />
        <StatCard
          title="Pending Follow-ups"
          value={stats?.pending_follow_ups || 0}
          change="Due today"
          icon={CalendarCheck}
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle className="font-['Manrope']">Weekly Overview</CardTitle>
            <CardDescription>Client sessions and revenue this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#84cc16" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                  <YAxis stroke="#a1a1aa" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#09090b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                      color: "#fafafa"
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#84cc16"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle className="font-['Manrope']">Recent Clients</CardTitle>
            <CardDescription>Latest client additions</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {recentActivity?.recent_clients?.length ? (
                  recentActivity.recent_clients.map((client) => (
                    <div key={client.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
                          {client.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {client.status === "active" ? "Active" : client.status}
                        </p>
                      </div>
                      <Badge variant={client.status === "active" ? "default" : "secondary"} className="shrink-0">
                        {client.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No clients yet</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Follow-ups */}
      <Card className="border-border/40 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-['Manrope']">Upcoming Follow-ups</CardTitle>
            <CardDescription>Scheduled check-ins with your clients</CardDescription>
          </div>
          <Link to="/follow-ups">
            <Button variant="ghost" size="sm" className="text-primary">
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentActivity?.upcoming_follow_ups?.length ? (
            <div className="space-y-3">
              {recentActivity.upcoming_follow_ups.map((followUp) => (
                <div key={followUp.id} className="flex items-center gap-4 p-3 rounded-lg border border-border/40 hover:border-primary/30 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{followUp.type}</p>
                    <p className="text-xs text-muted-foreground">{followUp.scheduled_date}</p>
                  </div>
                  <Badge variant="outline">{followUp.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No upcoming follow-ups</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ CLIENTS PAGE ============
function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", age: "", gender: "",
    height_cm: "", initial_weight_kg: "", goal_weight_kg: "",
    status: "active", notes: "", program_start_date: "", program_end_date: ""
  });

  const fetchClients = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await api.get("/clients", { params });
      setClients(res.data);
    } catch (err) {
      toast.error("Failed to load clients");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, [search, statusFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
        height_cm: formData.height_cm ? parseFloat(formData.height_cm) : null,
        initial_weight_kg: formData.initial_weight_kg ? parseFloat(formData.initial_weight_kg) : null,
        goal_weight_kg: formData.goal_weight_kg ? parseFloat(formData.goal_weight_kg) : null,
      };
      
      if (editingClient) {
        await api.put(`/clients/${editingClient.id}`, data);
        toast.success("Client updated successfully");
      } else {
        await api.post("/clients", data);
        toast.success("Client added successfully");
      }
      setDialogOpen(false);
      setEditingClient(null);
      resetForm();
      fetchClients();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save client");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this client?")) return;
    try {
      await api.delete(`/clients/${id}`);
      toast.success("Client deleted");
      fetchClients();
    } catch (err) {
      toast.error("Failed to delete client");
    }
  };

  const openEditDialog = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || "",
      email: client.email || "",
      phone: client.phone || "",
      age: client.age?.toString() || "",
      gender: client.gender || "",
      height_cm: client.height_cm?.toString() || "",
      initial_weight_kg: client.initial_weight_kg?.toString() || "",
      goal_weight_kg: client.goal_weight_kg?.toString() || "",
      status: client.status || "active",
      notes: client.notes || "",
      program_start_date: client.program_start_date || "",
      program_end_date: client.program_end_date || "",
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "", email: "", phone: "", age: "", gender: "",
      height_cm: "", initial_weight_kg: "", goal_weight_kg: "",
      status: "active", notes: "", program_start_date: "", program_end_date: ""
    });
  };

  const statusColors = {
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    "on-hold": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    inactive: "bg-gray-500/10 text-gray-500 border-gray-500/20"
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="clients-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your client roster</p>
        </div>
        <Button
          data-testid="add-client-btn"
          onClick={() => { resetForm(); setEditingClient(null); setDialogOpen(true); }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="client-search-input"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="status-filter" className="w-full sm:w-40 h-11">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on-hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Client List */}
      <Card className="border-border/40 bg-card/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-border/50">
                <th className="table-dense text-left w-[30%]">Client</th>
                <th className="table-dense text-left w-[15%]">Status</th>
                <th className="table-dense text-left w-[15%]">Weight</th>
                <th className="table-dense text-left w-[20%]">Program</th>
                <th className="table-dense text-right w-[20%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">Loading...</td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    No clients found. Add your first client!
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="table-dense" data-testid={`client-row-${client.id}`}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9 shrink-0">
                          <AvatarFallback className="bg-primary/20 text-primary text-sm">
                            {client.name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link
                            to={`/clients/${client.id}`}
                            className="font-medium hover:text-primary transition-colors truncate block"
                          >
                            {client.name}
                          </Link>
                          <p className="text-xs text-muted-foreground truncate">{client.email || client.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge variant="outline" className={statusColors[client.status]}>
                        {client.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="text-sm">
                        <span className="font-medium">{client.current_weight_kg || "—"}</span>
                        {client.goal_weight_kg && (
                          <span className="text-muted-foreground"> / {client.goal_weight_kg} kg</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm text-muted-foreground">
                        {client.program_start_date ? (
                          <span>{client.program_start_date.slice(0, 10)}</span>
                        ) : "—"}
                      </div>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link to={`/clients/${client.id}`}>
                          <Button variant="ghost" size="icon" data-testid={`view-client-${client.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`edit-client-${client.id}`}
                          onClick={() => openEditDialog(client)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`delete-client-${client.id}`}
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(client.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Manrope']">
              {editingClient ? "Edit Client" : "Add New Client"}
            </DialogTitle>
            <DialogDescription>
              {editingClient ? "Update client information" : "Add a new client to your roster"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  data-testid="client-name-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="client-email-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  data-testid="client-phone-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  data-testid="client-age-input"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                  <SelectTrigger data-testid="client-gender-select">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger data-testid="client-status-select">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  data-testid="client-height-input"
                  value={formData.height_cm}
                  onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initial_weight">Initial Weight (kg)</Label>
                <Input
                  id="initial_weight"
                  type="number"
                  step="0.1"
                  data-testid="client-initial-weight-input"
                  value={formData.initial_weight_kg}
                  onChange={(e) => setFormData({ ...formData, initial_weight_kg: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal_weight">Goal Weight (kg)</Label>
                <Input
                  id="goal_weight"
                  type="number"
                  step="0.1"
                  data-testid="client-goal-weight-input"
                  value={formData.goal_weight_kg}
                  onChange={(e) => setFormData({ ...formData, goal_weight_kg: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="program_start">Program Start</Label>
                <Input
                  id="program_start"
                  type="date"
                  data-testid="client-start-date-input"
                  value={formData.program_start_date}
                  onChange={(e) => setFormData({ ...formData, program_start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="program_end">Program End</Label>
                <Input
                  id="program_end"
                  type="date"
                  data-testid="client-end-date-input"
                  value={formData.program_end_date}
                  onChange={(e) => setFormData({ ...formData, program_end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                data-testid="client-notes-input"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="save-client-btn" className="bg-primary text-primary-foreground">
                {editingClient ? "Update Client" : "Add Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ CLIENT DETAIL PAGE ============
function ClientDetailPage() {
  const { id } = useLocation().pathname.split("/").pop();
  const clientId = useLocation().pathname.split("/")[2];
  const [client, setClient] = useState(null);
  const [weights, setWeights] = useState([]);
  const [dietPlans, setDietPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [newWeight, setNewWeight] = useState({ weight_kg: "", recorded_date: "", notes: "" });

  useEffect(() => {
    Promise.all([
      api.get(`/clients/${clientId}`),
      api.get(`/clients/${clientId}/weights`),
      api.get("/diet-plans", { params: { client_id: clientId } })
    ]).then(([clientRes, weightsRes, plansRes]) => {
      setClient(clientRes.data);
      setWeights(weightsRes.data);
      setDietPlans(plansRes.data);
    }).catch(() => {
      toast.error("Failed to load client details");
    }).finally(() => setLoading(false));
  }, [clientId]);

  const addWeight = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/clients/${clientId}/weights`, {
        weight_kg: parseFloat(newWeight.weight_kg),
        recorded_date: newWeight.recorded_date || undefined,
        notes: newWeight.notes || undefined
      });
      toast.success("Weight entry added");
      setWeightDialogOpen(false);
      setNewWeight({ weight_kg: "", recorded_date: "", notes: "" });
      // Refresh data
      const [clientRes, weightsRes] = await Promise.all([
        api.get(`/clients/${clientId}`),
        api.get(`/clients/${clientId}/weights`)
      ]);
      setClient(clientRes.data);
      setWeights(weightsRes.data);
    } catch (err) {
      toast.error("Failed to add weight entry");
    }
  };

  if (loading) return <LoadingScreen />;
  if (!client) return <div className="text-center py-12">Client not found</div>;

  const weightChartData = weights.slice(0, 30).reverse().map((w) => ({
    date: w.recorded_date.slice(5, 10),
    weight: w.weight_kg
  }));

  const weightProgress = client.initial_weight_kg && client.current_weight_kg
    ? client.initial_weight_kg - client.current_weight_kg
    : 0;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="client-detail-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/clients">
            <Button variant="ghost" size="icon">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </Button>
          </Link>
          <Avatar className="w-16 h-16">
            <AvatarFallback className="bg-primary/20 text-primary text-2xl font-semibold">
              {client.name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold font-['Manrope']">{client.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              {client.email && <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {client.email}</span>}
              {client.phone && <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {client.phone}</span>}
            </div>
          </div>
        </div>
        <Badge variant="outline" className={`${client.status === "active" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-gray-500/10 text-gray-500"}`}>
          {client.status}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Weight</p>
            <p className="text-2xl font-bold font-['Manrope'] mt-1">{client.current_weight_kg || "—"} kg</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Goal Weight</p>
            <p className="text-2xl font-bold font-['Manrope'] mt-1">{client.goal_weight_kg || "—"} kg</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Progress</p>
            <p className={`text-2xl font-bold font-['Manrope'] mt-1 ${weightProgress > 0 ? "text-green-500" : weightProgress < 0 ? "text-red-500" : ""}`}>
              {weightProgress > 0 ? "-" : "+"}{Math.abs(weightProgress).toFixed(1)} kg
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Height</p>
            <p className="text-2xl font-bold font-['Manrope'] mt-1">{client.height_cm || "—"} cm</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="progress" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="progress" data-testid="tab-progress">Progress</TabsTrigger>
          <TabsTrigger value="diet-plans" data-testid="tab-diet-plans">Diet Plans</TabsTrigger>
          <TabsTrigger value="info" data-testid="tab-info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-6">
          {/* Weight Chart */}
          <Card className="border-border/40 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-['Manrope']">Weight Progress</CardTitle>
                <CardDescription>Track weight changes over time</CardDescription>
              </div>
              <Button
                data-testid="add-weight-btn"
                onClick={() => setWeightDialogOpen(true)}
                className="bg-primary text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Weight
              </Button>
            </CardHeader>
            <CardContent>
              {weightChartData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightChartData}>
                      <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                      <XAxis dataKey="date" stroke="#a1a1aa" fontSize={12} />
                      <YAxis domain={['auto', 'auto']} stroke="#a1a1aa" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#09090b",
                          borderColor: "#27272a",
                          borderRadius: "8px",
                          color: "#fafafa"
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#84cc16"
                        strokeWidth={2}
                        dot={{ fill: "#84cc16", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">No weight entries yet</p>
              )}
            </CardContent>
          </Card>

          {/* Weight History */}
          <Card className="border-border/40 bg-card/50">
            <CardHeader>
              <CardTitle className="font-['Manrope']">Weight History</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {weights.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Scale className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{entry.weight_kg} kg</p>
                          <p className="text-xs text-muted-foreground">{entry.recorded_date}</p>
                        </div>
                      </div>
                      {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diet-plans" className="space-y-6">
          <Card className="border-border/40 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-['Manrope']">Diet Plans</CardTitle>
                <CardDescription>Assigned diet plans for this client</CardDescription>
              </div>
              <Link to={`/diet-plans?client_id=${clientId}`}>
                <Button className="bg-primary text-primary-foreground">
                  <Plus className="w-4 h-4 mr-2" /> Create Plan
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {dietPlans.length > 0 ? (
                <div className="space-y-4">
                  {dietPlans.map((plan) => (
                    <div key={plan.id} className="p-4 rounded-lg border border-border/40 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{plan.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {plan.daily_calories && <span>{plan.daily_calories} cal/day</span>}
                            <span>v{plan.version}</span>
                          </div>
                        </div>
                        <Badge variant={plan.is_active ? "default" : "secondary"}>
                          {plan.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">No diet plans assigned</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <Card className="border-border/40 bg-card/50">
            <CardHeader>
              <CardTitle className="font-['Manrope']">Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Age</p>
                  <p className="font-medium">{client.age || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p className="font-medium capitalize">{client.gender || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Program Start</p>
                  <p className="font-medium">{client.program_start_date || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Program End</p>
                  <p className="font-medium">{client.program_end_date || "—"}</p>
                </div>
              </div>
              {client.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium mt-1">{client.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Weight Dialog */}
      <Dialog open={weightDialogOpen} onOpenChange={setWeightDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Weight Entry</DialogTitle>
            <DialogDescription>Record a new weight measurement</DialogDescription>
          </DialogHeader>
          <form onSubmit={addWeight} className="space-y-4">
            <div className="space-y-2">
              <Label>Weight (kg) *</Label>
              <Input
                type="number"
                step="0.1"
                data-testid="weight-input"
                value={newWeight.weight_kg}
                onChange={(e) => setNewWeight({ ...newWeight, weight_kg: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                data-testid="weight-date-input"
                value={newWeight.recorded_date}
                onChange={(e) => setNewWeight({ ...newWeight, recorded_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                data-testid="weight-notes-input"
                value={newWeight.notes}
                onChange={(e) => setNewWeight({ ...newWeight, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWeightDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="save-weight-btn" className="bg-primary text-primary-foreground">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ DIET PLANS PAGE ============
function DietPlansPage() {
  const [plans, setPlans] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_id: "", name: "", description: "", daily_calories: "", instructions: "", is_active: true,
    meals: [{ time: "08:00", name: "Breakfast", items: [] }]
  });

  useEffect(() => {
    Promise.all([
      api.get("/diet-plans"),
      api.get("/clients")
    ]).then(([plansRes, clientsRes]) => {
      setPlans(plansRes.data);
      setClients(clientsRes.data);
    }).catch(() => {
      toast.error("Failed to load diet plans");
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/diet-plans", {
        ...formData,
        daily_calories: formData.daily_calories ? parseInt(formData.daily_calories) : null
      });
      toast.success("Diet plan created");
      setDialogOpen(false);
      const res = await api.get("/diet-plans");
      setPlans(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create diet plan");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this diet plan?")) return;
    try {
      await api.delete(`/diet-plans/${id}`);
      toast.success("Diet plan deleted");
      setPlans(plans.filter((p) => p.id !== id));
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const getClientName = (clientId) => clients.find((c) => c.id === clientId)?.name || "Unknown";

  return (
    <div className="space-y-6 animate-fade-in" data-testid="diet-plans-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Diet Plans</h1>
          <p className="text-muted-foreground mt-1">Create and manage diet plans</p>
        </div>
        <Button
          data-testid="create-diet-plan-btn"
          onClick={() => setDialogOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
        >
          <Plus className="w-4 h-4 mr-2" /> Create Plan
        </Button>
      </div>

      {loading ? (
        <LoadingScreen />
      ) : plans.length === 0 ? (
        <Card className="border-border/40 bg-card/50">
          <CardContent className="py-12 text-center">
            <Utensils className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No diet plans yet. Create your first plan!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className="border-border/40 bg-card/50 hover:border-primary/30 transition-all" data-testid={`diet-plan-${plan.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="font-['Manrope'] text-lg">{plan.name}</CardTitle>
                    <CardDescription className="mt-1">{getClientName(plan.client_id)}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDelete(plan.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {plan.description && <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>}
                <div className="flex items-center gap-4 text-sm">
                  {plan.daily_calories && (
                    <span className="flex items-center gap-1">
                      <Activity className="w-4 h-4 text-primary" /> {plan.daily_calories} cal
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Utensils className="w-4 h-4 text-primary" /> {plan.meals?.length || 0} meals
                  </span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">v{plan.version}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-['Manrope']">Create Diet Plan</DialogTitle>
            <DialogDescription>Create a new diet plan for a client</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                  <SelectTrigger data-testid="plan-client-select">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plan Name *</Label>
                <Input
                  data-testid="plan-name-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                data-testid="plan-description-input"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Daily Calories</Label>
                <Input
                  type="number"
                  data-testid="plan-calories-input"
                  value={formData.daily_calories}
                  onChange={(e) => setFormData({ ...formData, daily_calories: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea
                data-testid="plan-instructions-input"
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="save-plan-btn" className="bg-primary text-primary-foreground">Create Plan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ FOLLOW-UPS PAGE ============
function FollowUpsPage() {
  const [followUps, setFollowUps] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ client_id: "", scheduled_date: "", type: "check-in", notes: "" });

  useEffect(() => {
    Promise.all([
      api.get("/follow-ups"),
      api.get("/clients")
    ]).then(([followUpsRes, clientsRes]) => {
      setFollowUps(followUpsRes.data);
      setClients(clientsRes.data);
    }).catch(() => {
      toast.error("Failed to load follow-ups");
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/follow-ups", formData);
      toast.success("Follow-up scheduled");
      setDialogOpen(false);
      const res = await api.get("/follow-ups");
      setFollowUps(res.data);
    } catch (err) {
      toast.error("Failed to create follow-up");
    }
  };

  const markComplete = async (id) => {
    try {
      await api.put(`/follow-ups/${id}`, { status: "completed", completed_at: new Date().toISOString() });
      toast.success("Follow-up completed");
      const res = await api.get("/follow-ups");
      setFollowUps(res.data);
    } catch (err) {
      toast.error("Failed to update");
    }
  };

  const getClientName = (clientId) => clients.find((c) => c.id === clientId)?.name || "Unknown";

  const statusColors = {
    scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    completed: "bg-green-500/10 text-green-500 border-green-500/20",
    missed: "bg-red-500/10 text-red-500 border-red-500/20"
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="follow-ups-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Follow-ups</h1>
          <p className="text-muted-foreground mt-1">Schedule and track client follow-ups</p>
        </div>
        <Button
          data-testid="schedule-followup-btn"
          onClick={() => setDialogOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
        >
          <Plus className="w-4 h-4 mr-2" /> Schedule Follow-up
        </Button>
      </div>

      {loading ? (
        <LoadingScreen />
      ) : (
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-0">
            {followUps.length === 0 ? (
              <div className="py-12 text-center">
                <CalendarCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No follow-ups scheduled</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {followUps.map((followUp) => (
                  <div key={followUp.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors" data-testid={`followup-${followUp.id}`}>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{getClientName(followUp.client_id)}</p>
                        <Badge variant="outline" className="text-xs">{followUp.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{followUp.scheduled_date}</p>
                      {followUp.notes && <p className="text-sm text-muted-foreground mt-1">{followUp.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusColors[followUp.status]}>
                        {followUp.status}
                      </Badge>
                      {followUp.status === "scheduled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`complete-followup-${followUp.id}`}
                          onClick={() => markComplete(followUp.id)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Complete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Schedule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-['Manrope']">Schedule Follow-up</DialogTitle>
            <DialogDescription>Schedule a new follow-up with a client</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                <SelectTrigger data-testid="followup-client-select">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                data-testid="followup-date-input"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger data-testid="followup-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check-in">Check-in</SelectItem>
                  <SelectItem value="weigh-in">Weigh-in</SelectItem>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="progress-review">Progress Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                data-testid="followup-notes-input"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="save-followup-btn" className="bg-primary text-primary-foreground">Schedule</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ FINANCE PAGE ============
function FinancePage() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "income", category: "", amount: "", description: "", client_id: "", transaction_date: ""
  });

  useEffect(() => {
    Promise.all([
      api.get("/transactions"),
      api.get("/transactions/summary"),
      api.get("/clients")
    ]).then(([txRes, summaryRes, clientsRes]) => {
      setTransactions(txRes.data);
      setSummary(summaryRes.data);
      setClients(clientsRes.data);
    }).catch(() => {
      toast.error("Failed to load finance data");
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/transactions", {
        ...formData,
        amount: parseFloat(formData.amount),
        client_id: formData.client_id || null
      });
      toast.success("Transaction added");
      setDialogOpen(false);
      const [txRes, summaryRes] = await Promise.all([
        api.get("/transactions"),
        api.get("/transactions/summary")
      ]);
      setTransactions(txRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      toast.error("Failed to add transaction");
    }
  };

  const getClientName = (clientId) => clients.find((c) => c.id === clientId)?.name || null;

  const incomeCategories = ["Consultation", "Program Fee", "Follow-up", "Package", "Other"];
  const expenseCategories = ["Equipment", "Supplies", "Marketing", "Rent", "Utilities", "Other"];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="finance-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Finance</h1>
          <p className="text-muted-foreground mt-1">Track your income and expenses</p>
        </div>
        <Button
          data-testid="add-transaction-btn"
          onClick={() => setDialogOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Transaction
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="stat-highlight border-border/40 bg-card/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Income</p>
                <p className="text-3xl font-bold font-['Manrope'] mt-2 text-green-500">
                  ₹{(summary?.total_income || 0).toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-highlight border-border/40 bg-card/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                <p className="text-3xl font-bold font-['Manrope'] mt-2 text-red-500">
                  ₹{(summary?.total_expense || 0).toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-highlight border-border/40 bg-card/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Net Profit</p>
                <p className={`text-3xl font-bold font-['Manrope'] mt-2 ${(summary?.net || 0) >= 0 ? "text-primary" : "text-red-500"}`}>
                  ₹{(summary?.net || 0).toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="font-['Manrope']">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center">
              <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors" data-testid={`transaction-${tx.id}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tx.type === "income" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    {tx.type === "income" ? (
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{tx.category}</p>
                      {getClientName(tx.client_id) && (
                        <Badge variant="outline" className="text-xs">{getClientName(tx.client_id)}</Badge>
                      )}
                    </div>
                    {tx.description && <p className="text-sm text-muted-foreground truncate">{tx.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{tx.transaction_date}</p>
                  </div>
                  <p className={`font-semibold ${tx.type === "income" ? "text-green-500" : "text-red-500"}`}>
                    {tx.type === "income" ? "+" : "-"}₹{tx.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Transaction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-['Manrope']">Add Transaction</DialogTitle>
            <DialogDescription>Record a new income or expense</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v, category: "" })}>
                <SelectTrigger data-testid="transaction-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger data-testid="transaction-category-select">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {(formData.type === "income" ? incomeCategories : expenseCategories).map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                data-testid="transaction-amount-input"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            {formData.type === "income" && (
              <div className="space-y-2">
                <Label>Client (Optional)</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                  <SelectTrigger data-testid="transaction-client-select">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                data-testid="transaction-date-input"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                data-testid="transaction-description-input"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="save-transaction-btn" className="bg-primary text-primary-foreground">Add Transaction</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ SETTINGS PAGE ============
function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in" data-testid="settings-page">
      <div>
        <h1 className="text-3xl font-bold font-['Manrope']">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="font-['Manrope']">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-primary/20 text-primary text-xl font-semibold">
                {user?.name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-medium">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="outline" className="mt-2 capitalize">{user?.role}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="font-['Manrope']">Preferences</CardTitle>
          <CardDescription>Customize your experience</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Additional settings coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ MAIN APP ============
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#09090b",
              border: "1px solid #27272a",
              color: "#fafafa"
            }
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/clients" element={<ClientsPage />} />
                    <Route path="/clients/:id" element={<ClientDetailPage />} />
                    <Route path="/diet-plans" element={<DietPlansPage />} />
                    <Route path="/follow-ups" element={<FollowUpsPage />} />
                    <Route path="/finance" element={<FinancePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
