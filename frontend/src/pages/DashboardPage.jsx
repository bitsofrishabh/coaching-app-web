import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Users, DollarSign, Utensils, CalendarCheck, TrendingUp, TrendingDown, ChevronRight, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/app/LoadingScreen";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

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

export function DashboardPage() {
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
    }).catch(() => {
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
      <div>
        <h1 className="text-3xl font-bold font-['Manrope']">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your practice overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Clients" value={stats?.total_clients || 0} change={`${stats?.active_clients || 0} active`} icon={Users} />
        <StatCard title="Monthly Revenue" value={`₹${(stats?.monthly_revenue || 0).toLocaleString()}`} change="+12% from last month" trend="up" icon={DollarSign} />
        <StatCard title="Active Diet Plans" value={stats?.active_diet_plans || 0} icon={Utensils} />
        <StatCard title="Pending Follow-ups" value={stats?.pending_follow_ups || 0} change="Due today" icon={CalendarCheck} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <Area type="monotone" dataKey="revenue" stroke="#84cc16" fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

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
