import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Users, DollarSign, CalendarCheck, ChevronRight, Calendar, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/app/LoadingScreen";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

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
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overview</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Welcome back. Here's your practice overview.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Clients" value={stats?.total_clients || 0} sub={`${stats?.active_clients || 0} active`} icon={<Users className="h-[18px] w-[18px]" />} tone="primary" />
        <StatCard label="Monthly Revenue" value={`₹${(stats?.monthly_revenue || 0).toLocaleString()}`} sub="+12% from last month" subTone="success" icon={<DollarSign className="h-[18px] w-[18px]" />} tone="success" />
        <StatCard label="New Clients This Month" value={stats?.new_clients_this_month || 0} sub={monthLabel} icon={<UserPlus className="h-[18px] w-[18px]" />} tone="info" />
        <StatCard label="Pending Follow-ups" value={stats?.pending_follow_ups || 0} sub="Scheduled and overdue" icon={<CalendarCheck className="h-[18px] w-[18px]" />} tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Overview</CardTitle>
            <CardDescription>Day-wise new client enrollments in {monthLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorNewClients" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E8156" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#2E8156" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E7E7E1" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke="#A6A69C" fontSize={12} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(chartData.length / 8))} />
                  <YAxis stroke="#A6A69C" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value) => [`${value} client${value === 1 ? "" : "s"}`, "New Clients"]}
                    labelFormatter={(label) => `${monthLabel} ${label}`}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#DEDED7",
                      borderRadius: "10px",
                      color: "#16201A",
                      boxShadow: "0 8px 24px rgba(22,32,26,.10)"
                    }}
                  />
                  <Area type="monotone" dataKey="new_clients" stroke="#1F6B45" strokeWidth={2} fillOpacity={1} fill="url(#colorNewClients)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>New Clients in {monthLabel}</CardTitle>
            <CardDescription>Clients enrolled during the current month</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {recentActivity?.recent_clients?.length ? (
                  recentActivity.recent_clients.map((client) => (
                    <div key={client.id} className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-accent">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-accent text-sm font-semibold text-primary">
                          {client.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{client.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Added {formatDisplayDate(client.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={client.status} className="shrink-0" />
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">No new clients added in {monthLabel} yet</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Follow-ups</CardTitle>
              <CardDescription>Scheduled check-ins with your clients</CardDescription>
            </div>
            <Link to="/follow-ups">
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                View all <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentActivity?.upcoming_follow_ups?.length ? (
              <div className="space-y-3">
                {recentActivity.upcoming_follow_ups.map((followUp) => (
                  <div key={followUp.id} className="flex items-center gap-4 rounded-lg border border-border p-3 transition-colors hover:border-primary/40 hover:bg-accent/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{followUp.client_name}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {followUp.type} • {formatDisplayDate(followUp.scheduled_date)}
                      </p>
                    </div>
                    <StatusBadge status={followUp.status} className="shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No upcoming follow-ups</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Diet Plans Expiring Soon</CardTitle>
            <CardDescription>Plans ending in the next 5 days</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity?.expiring_diet_plans?.length ? (
              <div className="space-y-3">
                {recentActivity.expiring_diet_plans.map((plan) => (
                  <div key={plan.id} className="flex items-center gap-4 rounded-lg border border-border p-3 transition-colors hover:border-warning/40 hover:bg-accent/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-bg">
                      <Calendar className="h-5 w-5 text-warning" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{plan.client_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Ends on {formatDisplayDate(plan.diet_end_date)}
                      </p>
                    </div>
                    <StatusBadge
                      tone={plan.days_until_expiry === 0 ? "danger" : "warning"}
                      label={plan.days_until_expiry === 0 ? "Today" : `${plan.days_until_expiry}d left`}
                      className="shrink-0"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No diet plans expiring in the next 5 days</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
