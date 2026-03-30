import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bell, CalendarClock, ChevronRight, ClipboardList } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

export function PendingTasksBell() {
  const [feed, setFeed] = useState({ total_count: 0, tasks: [], window_days: 3 });
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const loadTasks = async () => {
    try {
      const res = await api.get("/tasks/pending");
      setFeed(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load pending tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadTasks();
    const intervalId = window.setInterval(loadTasks, 60000);
    return () => window.clearInterval(intervalId);
  }, [location.pathname]);

  const previewTasks = useMemo(() => (feed.tasks || []).slice(0, 4), [feed.tasks]);
  const totalCount = feed.total_count || 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative shrink-0" aria-label="Pending tasks">
          <Bell className="h-5 w-5" />
          {totalCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {totalCount > 9 ? "9+" : totalCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] space-y-4 p-0">
        <div className="border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Pending Tasks</p>
              <p className="text-xs text-muted-foreground">
                Deadlines due in the next {feed.window_days || 3} days
              </p>
            </div>
            <Badge variant="outline">{totalCount}</Badge>
          </div>
        </div>

        <div className="space-y-3 px-4">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading tasks...</p>
          ) : previewTasks.length ? (
            previewTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className="w-full rounded-lg border border-border/40 p-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/30"
                onClick={() => navigate(task.task_type === "follow-up" ? "/follow-ups" : `/clients/${task.client_id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.client_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{task.title}</p>
                  </div>
                  <Badge variant="outline" className={getTaskTone(task)}>
                    {task.days_left === 0 ? "Today" : `${task.days_left}d`}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  <span>{formatDisplayDate(task.due_date)}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">No pending tasks</p>
              <p className="mt-1 text-xs text-muted-foreground">Nothing due in the next 3 days.</p>
            </div>
          )}
        </div>

        <div className="border-t border-border/50 px-4 py-3">
          <Link to="/pending-tasks" className="block">
            <Button variant="outline" className="w-full">
              View All Tasks <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
