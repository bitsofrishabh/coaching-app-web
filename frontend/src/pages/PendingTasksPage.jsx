import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarClock, ChevronRight, ClipboardList, Flag, Utensils, PhoneCall } from "lucide-react";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/app/LoadingScreen";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const formatDisplayDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const getTaskTone = (task) => {
  if (task.days_left <= 1) return "border-red-500/25 bg-red-500/8 text-red-500";
  if (task.days_left <= 2) return "border-orange-400/25 bg-orange-400/8 text-orange-500";
  return "border-emerald-500/25 bg-emerald-500/8 text-emerald-600";
};

export function PendingTasksPage() {
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/tasks/pending")
      .then((res) => setFeed(res.data))
      .catch((error) => {
        toast.error(error.response?.data?.detail || "Failed to load pending tasks");
      })
      .finally(() => setLoading(false));
  }, []);

  const taskGroups = useMemo(() => {
    const tasks = feed?.tasks || [];
    return {
      diet: tasks.filter((task) => task.task_type === "diet-expiry"),
      programs: tasks.filter((task) => task.task_type === "program-expiry"),
      followUps: tasks.filter((task) => task.task_type === "follow-up"),
    };
  }, [feed]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="space-y-8 animate-fade-in" data-testid="pending-tasks-page">
      <div className="rounded-[2rem] border border-[#E3E0D8] bg-white/90 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A7BC8]">Action Queue</p>
        <h1 className="mt-1 font-['Sora'] text-3xl font-semibold text-[#18115E]">Pending Tasks</h1>
        <p className="mt-2 text-[#5F6472]">
          Diet and follow-up deadlines due in the next {feed?.window_days || 3} days. Program endings due in the next {feed?.program_window_days || 7} days.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="border-[#E3E0D8] bg-white shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A7BC8]">Total Pending Tasks</p>
            <p className="mt-2 font-['Sora'] text-3xl font-semibold text-[#18115E]">{feed?.total_count || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E3E0D8] bg-white shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A7BC8]">Diet Expiring Soon</p>
            <p className="mt-2 font-['Sora'] text-3xl font-semibold text-[#18115E]">{feed?.diet_expiry_count || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E3E0D8] bg-white shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A7BC8]">Programs Ending Soon</p>
            <p className="mt-2 font-['Sora'] text-3xl font-semibold text-[#18115E]">{feed?.program_expiry_count || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E3E0D8] bg-white shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A7BC8]">Follow-ups Due Soon</p>
            <p className="mt-2 font-['Sora'] text-3xl font-semibold text-[#18115E]">{feed?.follow_up_count || 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="border-[#E3E0D8] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-['Sora'] text-[#18115E]">
              <Utensils className="h-5 w-5 text-primary" /> Diet Expiry Tasks
            </CardTitle>
            <CardDescription>Clients whose diet plan ends within the next few days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {taskGroups.diet.length ? (
              taskGroups.diet.map((task) => (
                <div key={task.id} className="rounded-2xl border border-[#E3E0D8] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={`/clients/${task.client_id}`} className="font-medium text-primary hover:underline">
                        {task.client_name}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">{task.title}</p>
                    </div>
                    <Badge variant="outline" className={getTaskTone(task)}>
                      {task.days_left === 0 ? "Today" : `${task.days_left}d left`}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarClock className="h-4 w-4" />
                      <span>{formatDisplayDate(task.due_date)}</span>
                    </div>
                    <Link to={`/clients/${task.client_id}`}>
                      <Button variant="ghost" size="sm" className="text-primary">
                        Open Client <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No diet plans expiring in the next 3 days.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E3E0D8] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-['Sora'] text-[#18115E]">
              <Flag className="h-5 w-5 text-primary" /> Program End Tasks
            </CardTitle>
            <CardDescription>Clients whose program ends within the next 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {taskGroups.programs.length ? (
              taskGroups.programs.map((task) => (
                <div key={task.id} className="rounded-2xl border border-[#E3E0D8] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={`/clients/${task.client_id}`} className="font-medium text-primary hover:underline">
                        {task.client_name}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">{task.title}</p>
                    </div>
                    <Badge variant="outline" className={getTaskTone(task)}>
                      {task.days_left === 0 ? "Today" : `${task.days_left}d left`}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarClock className="h-4 w-4" />
                      <span>{formatDisplayDate(task.due_date)}</span>
                    </div>
                    <Link to={`/clients/${task.client_id}`}>
                      <Button variant="ghost" size="sm" className="text-primary">
                        Open Client <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No programs ending in the next 7 days.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E3E0D8] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-['Sora'] text-[#18115E]">
              <PhoneCall className="h-5 w-5 text-primary" /> Follow-up Tasks
            </CardTitle>
            <CardDescription>Scheduled follow-up calls due within the next few days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {taskGroups.followUps.length ? (
              taskGroups.followUps.map((task) => (
                <div key={task.id} className="rounded-2xl border border-[#E3E0D8] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={`/clients/${task.client_id}`} className="font-medium text-primary hover:underline">
                        {task.client_name}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">{task.title}</p>
                    </div>
                    <Badge variant="outline" className={getTaskTone(task)}>
                      {task.days_left === 0 ? "Today" : `${task.days_left}d left`}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarClock className="h-4 w-4" />
                      <span>{formatDisplayDate(task.due_date)}</span>
                    </div>
                    <Link to="/follow-ups">
                      <Button variant="ghost" size="sm" className="text-primary">
                        Open Follow-ups <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No follow-up calls due in the next 3 days.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {!(feed?.tasks?.length) ? (
        <Card className="border-[#E3E0D8] bg-white shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/60" />
            <p className="mt-4 text-base font-medium">No pending tasks right now.</p>
            <p className="mt-1 text-sm text-muted-foreground">New due items will appear here automatically.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
