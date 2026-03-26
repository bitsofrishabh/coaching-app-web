import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Users, DollarSign, CalendarCheck, TrendingUp, TrendingDown, ChevronRight, Calendar, UserPlus } from "lucide-react";
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

function formatDisplayDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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

  const monthLabel = recentActivity?.current_month_label || stats?.current_month_label || new Date().toLocaleString("en-US", { month: "long" });
  const chartData = recentActivity?.monthly_overview || [];

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard-page">
      <div>
        <h1 className="text-3xl font-bold font-['Manrope']">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your practice overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Clients" value={stats?.total_clients || 0} change={`${stats?.active_clients || 0} active`} icon={Users} />
        <StatCard title="Monthly Revenue" value={`₹${(stats?.monthly_revenue || 0).toLocaleString()}`} change="+12% from last month" trend="up" icon={DollarSign} />
        <StatCard title="New Clients This Month" value={stats?.new_clients_this_month || 0} change={monthLabel} icon={UserPlus} />
        <StatCard title="Pending Follow-ups" value={stats?.pending_follow_ups || 0} change="Scheduled and overdue" icon={CalendarCheck} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle className="font-['Manrope']">Monthly Overview</CardTitle>
            <CardDescription>Day-wise new client enrollments in {monthLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorNewClients" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#84cc16" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} interval={Math.max(0, Math.floor(chartData.length / 8))} />
                  <YAxis stroke="#a1a1aa" fontSize={12} />
                  <Tooltip
                    formatter={(value) => [`${value} client${value === 1 ? "" : "s"}`, "New Clients"]}
                    labelFormatter={(label) => `${monthLabel} ${label}`}
                    contentStyle={{
                      backgroundColor: "#09090b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                      color: "#fafafa"
                    }}
                  />
                  <Area type="monotone" dataKey="new_clients" stroke="#84cc16" strokeWidth={2} fillOpacity={1} fill="url(#colorNewClients)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle className="font-['Manrope']">New Clients in {monthLabel}</CardTitle>
            <CardDescription>Clients enrolled during the current month</CardDescription>
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
                          Added {formatDisplayDate(client.created_at)}
                        </p>
                      </div>
                      <Badge variant={client.status === "active" ? "default" : "secondary"} className="shrink-0">
                        {client.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No new clients added in {monthLabel} yet</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{followUp.client_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {followUp.type} • {formatDisplayDate(followUp.scheduled_date)}
                      </p>
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

        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle className="font-['Manrope']">Diet Plans Expiring Soon</CardTitle>
            <CardDescription>Plans ending in the next 5 days</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity?.expiring_diet_plans?.length ? (
              <div className="space-y-3">
                {recentActivity.expiring_diet_plans.map((plan) => (
                  <div key={plan.id} className="flex items-center gap-4 p-3 rounded-lg border border-border/40 hover:border-primary/30 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{plan.client_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Ends on {formatDisplayDate(plan.diet_end_date)}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {plan.days_until_expiry === 0 ? "Today" : `${plan.days_until_expiry}d left`}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No diet plans expiring in the next 5 days</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
