import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bell, CalendarClock, ClipboardList, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

const getTaskTypeLabel = (taskType) => {
  if (taskType === "diet-expiry") return "Diet";
  if (taskType === "program-expiry") return "Program";
  if (taskType === "follow-up") return "Follow-up";
  if (taskType === "manual") return "Task";
  return "Task";
};

const EMPTY_TASK_FORM = {
  client_id: "",
  comment: "",
  due_date: "",
};

export function PendingTasksBell() {
  const [feed, setFeed] = useState({
    total_count: 0,
    tasks: [],
    window_days: 3,
    program_window_days: 7,
    diet_expiry_count: 0,
    follow_up_count: 0,
    program_expiry_count: 0,
    manual_task_count: 0,
  });
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
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

  const loadClients = async () => {
    try {
      const res = await api.get("/clients", { params: { limit: 500 } });
      setClients(res.data || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load clients");
    }
  };

  useEffect(() => {
    setLoading(true);
    loadTasks();
    const intervalId = window.setInterval(loadTasks, 60000);
    return () => window.clearInterval(intervalId);
  }, [location.pathname]);

  useEffect(() => {
    if (!modalOpen || clients.length) return;
    loadClients();
  }, [modalOpen, clients.length]);

  const totalCount = feed.total_count || 0;
  const visibleTasks = useMemo(() => feed.tasks || [], [feed.tasks]);

  const handleCreateTask = async () => {
    if (!taskForm.client_id || !taskForm.comment.trim() || !taskForm.due_date) {
      toast.error("Client, comment, and task date are required");
      return;
    }

    setSavingTask(true);
    try {
      await api.post("/tasks", {
        client_id: taskForm.client_id,
        comment: taskForm.comment.trim(),
        due_date: taskForm.due_date,
      });
      toast.success("Task added");
      setTaskForm(EMPTY_TASK_FORM);
      await loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add task");
    } finally {
      setSavingTask(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative shrink-0"
        aria-label="Pending tasks"
        onClick={() => setModalOpen(true)}
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        ) : null}
      </Button>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border/50 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="font-['Manrope'] text-2xl">Pending Tasks</DialogTitle>
                <DialogDescription className="mt-1">
                  Diet and follow-up deadlines in the next {feed.window_days || 3} days, program endings in the next {feed.program_window_days || 7} days, plus any manual tasks you add here.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{feed.diet_expiry_count || 0} diet</Badge>
                <Badge variant="outline">{feed.program_expiry_count || 0} program</Badge>
                <Badge variant="outline">{feed.follow_up_count || 0} follow-up</Badge>
                <Badge variant="outline">{feed.manual_task_count || 0} manual</Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-5">
            <div className="rounded-xl border border-border/50">
              <div className="grid grid-cols-[1.2fr_2fr_160px] gap-4 border-b border-border/50 bg-muted/20 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div>Client Name</div>
                <div>Comment</div>
                <div>Task Date</div>
              </div>
              <div className="max-h-[340px] overflow-y-auto">
                {loading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">Loading tasks...</div>
                ) : visibleTasks.length ? (
                  visibleTasks.map((task) => (
                    <div
                      key={task.id}
                      className="grid grid-cols-[1.2fr_2fr_160px] gap-4 border-b border-border/40 px-4 py-3 text-sm last:border-b-0"
                    >
                      <button
                        type="button"
                        className="truncate text-left font-medium text-foreground transition-colors hover:text-primary"
                        onClick={() => {
                          setModalOpen(false);
                          navigate(`/clients/${task.client_id}`);
                        }}
                      >
                        {task.client_name}
                      </button>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate">{task.comment || task.title}</span>
                          <Badge variant="outline" className={getTaskTone(task)}>
                            {getTaskTypeLabel(task.task_type)}
                          </Badge>
                        </div>
                        {task.created_by_name ? (
                          <p className="mt-1 text-xs text-muted-foreground">Added by {task.created_by_name}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalendarClock className="h-4 w-4" />
                        <span>{formatDisplayDate(task.due_date)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ClipboardList className="h-8 w-8 text-muted-foreground/60" />
                    <p className="mt-3 text-sm font-medium">No pending tasks</p>
                    <p className="mt-1 text-xs text-muted-foreground">Nothing due in the next 3 days.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border/50 bg-muted/10 px-6 py-5">
            <div className="mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Add New Task</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_2fr_160px_auto] md:items-end">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={taskForm.client_id || "none"} onValueChange={(value) => setTaskForm((prev) => ({ ...prev, client_id: value === "none" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Comment</Label>
                <Input
                  value={taskForm.comment}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, comment: e.target.value }))}
                  placeholder="Add task comment"
                />
              </div>
              <div className="space-y-2">
                <Label>Task Date</Label>
                <DatePickerInput
                  value={taskForm.due_date}
                  onChange={(value) => setTaskForm((prev) => ({ ...prev, due_date: value }))}
                  placeholder="Select task date"
                />
              </div>
              <Button onClick={handleCreateTask} disabled={savingTask}>
                {savingTask ? "Adding..." : "Add Task"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
