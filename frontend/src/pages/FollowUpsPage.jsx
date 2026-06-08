import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, CalendarCheck, Calendar, CheckCircle, Loader2, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/app/LoadingScreen";

const FOLLOW_UP_TYPE_OPTIONS = [
  { value: "check-in", label: "Check-in" },
  { value: "weigh-in", label: "Weigh-in" },
  { value: "consultation", label: "Consultation" },
  { value: "progress-review", label: "Progress Review" },
];

const formatDisplayDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDisplayDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFollowUpSchedule = (followUp) => {
  if (!followUp?.scheduled_date) return "—";
  const dateLabel = formatDisplayDate(followUp.scheduled_date);
  return followUp.scheduled_time ? `${dateLabel} • ${followUp.scheduled_time}` : dateLabel;
};

const getLocalDateFromIso = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if ([year, month, day].some(Number.isNaN)) return null;
  return new Date(year, month - 1, day);
};

const startOfWeek = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
};

const endOfWeek = (value) => {
  const date = startOfWeek(value);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
};

const FOLLOW_UP_GROUP_ORDER = ["upcoming", "this-week", "last-week", "last-15-days", "older"];
const FOLLOW_UP_GROUP_LABELS = {
  upcoming: "Upcoming",
  "this-week": "This Week",
  "last-week": "Last Week",
  "last-15-days": "Last 15 Days",
  older: "Older",
};

const getFollowUpGroupKey = (scheduledDate) => {
  const targetDate = getLocalDateFromIso(scheduledDate);
  if (!targetDate) return "older";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (targetDate > today) {
    return "upcoming";
  }

  const currentWeekStart = startOfWeek(today);
  const currentWeekEnd = endOfWeek(today);
  const previousWeekEnd = new Date(currentWeekStart);
  previousWeekEnd.setMilliseconds(-1);
  const previousWeekStart = startOfWeek(previousWeekEnd);
  const last15Start = new Date(today);
  last15Start.setDate(last15Start.getDate() - 15);

  if (targetDate >= currentWeekStart && targetDate <= currentWeekEnd) {
    return "this-week";
  }

  if (targetDate >= previousWeekStart && targetDate <= previousWeekEnd) {
    return "last-week";
  }

  if (targetDate >= last15Start && targetDate < previousWeekStart) {
    return "last-15-days";
  }

  return "older";
};

export function FollowUpsPage() {
  const [followUps, setFollowUps] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ client_id: "", scheduled_date: "", scheduled_time: "", type: "check-in", notes: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [selectedFollowUp, setSelectedFollowUp] = useState(null);
  const [followUpNoteDraft, setFollowUpNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadFollowUps = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const [followUpsRes, clientsRes] = await Promise.all([
      api.get("/follow-ups"),
      api.get("/clients", { params: { limit: 5000 } })
    ]);
      setFollowUps(followUpsRes.data);
      setClients(clientsRes.data);
    } catch (error) {
      toast.error("Failed to load follow-ups");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFollowUps({ showLoader: true });
  }, [loadFollowUps]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/follow-ups", formData);
      toast.success("Follow-up scheduled");
      setDialogOpen(false);
      setFormData({ client_id: "", scheduled_date: "", scheduled_time: "", type: "check-in", notes: "" });
      await loadFollowUps();
    } catch (err) {
      toast.error("Failed to create follow-up");
    }
  };

  const markComplete = async (id) => {
    try {
      await api.put(`/follow-ups/${id}`, { status: "completed", completed_at: new Date().toISOString() });
      toast.success("Follow-up completed");
      await loadFollowUps();
    } catch (err) {
      toast.error("Failed to update");
    }
  };

  const openFollowUpDetail = (followUp) => {
    setSelectedFollowUp(followUp);
    setFollowUpNoteDraft(followUp?.notes || "");
  };

  const saveFollowUpNotes = async () => {
    if (!selectedFollowUp) return;
    setNoteSaving(true);
    try {
      const res = await api.put(`/follow-ups/${selectedFollowUp.id}`, {
        notes: followUpNoteDraft.trim() || "",
      });
      setSelectedFollowUp(res.data);
      setFollowUps((prev) => prev.map((followUp) => (followUp.id === res.data.id ? res.data : followUp)));
      toast.success("Follow-up note updated");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update note");
    } finally {
      setNoteSaving(false);
    }
  };

  const updateFollowUpStatus = async (followUpId, status) => {
    setActionLoading(true);
    try {
      const payload = {
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      };
      const res = await api.put(`/follow-ups/${followUpId}`, payload);
      setSelectedFollowUp(res.data);
      setFollowUps((prev) => prev.map((followUp) => (followUp.id === res.data.id ? res.data : followUp)));
      toast.success(`Follow-up marked ${status}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update follow-up");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteFollowUp = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await api.delete(`/follow-ups/${deleteTarget.id}`);
      setSelectedFollowUp(null);
      setDeleteTarget(null);
      setFollowUps((prev) => prev.filter((followUp) => followUp.id !== deleteTarget.id));
      toast.success("Follow-up deleted");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete follow-up");
    } finally {
      setActionLoading(false);
    }
  };

  const getClientName = (clientId) => clients.find((c) => c.id === clientId)?.name || "Unknown";

  const statusColors = {
    scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    completed: "bg-violet-500/10 text-violet-500 border-violet-500/20",
    missed: "bg-red-500/10 text-red-500 border-red-500/20"
  };

  const filteredFollowUps = followUps
    .filter((followUp) => {
      const clientName = getClientName(followUp.client_id).toLowerCase();
      const matchesClient = !searchQuery.trim() || clientName.includes(searchQuery.trim().toLowerCase());
      const matchesDate = !filterDate || (followUp.scheduled_date || "").slice(0, 10) === filterDate;
      return matchesClient && matchesDate;
    })
    .sort((left, right) => {
      const leftValue = left.scheduled_date || "";
      const rightValue = right.scheduled_date || "";
      return rightValue.localeCompare(leftValue);
    });

  const groupedFollowUps = FOLLOW_UP_GROUP_ORDER
    .map((groupKey) => ({
      key: groupKey,
      label: FOLLOW_UP_GROUP_LABELS[groupKey],
      items: filteredFollowUps.filter((followUp) => getFollowUpGroupKey(followUp.scheduled_date) === groupKey),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-7 animate-fade-in" data-testid="follow-ups-page">
      <div className="flex flex-col justify-between gap-4 rounded-[2rem] border border-[#E3E0D8] bg-white/90 p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A7BC8]">Schedule</p>
          <h1 className="mt-1 font-['Sora'] text-3xl font-semibold text-[#18115E]">Follow-ups</h1>
          <p className="mt-2 text-[#5F6472]">Schedule and track client follow-ups.</p>
        </div>
        <Button data-testid="schedule-followup-btn" onClick={() => setDialogOpen(true)} className="rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-violet-500/20 hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Schedule Follow-up
        </Button>
      </div>

      {!loading && (
        <Card className="border-[#E3E0D8] bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Filter by client name"
                  className="rounded-2xl border-[#E3E0D8] bg-white pl-9"
                />
              </div>
              <DatePickerInput
                value={filterDate}
                onChange={setFilterDate}
                placeholder="Filter by date"
              />
              <Button variant="outline" className="rounded-2xl bg-white" onClick={() => { setSearchQuery(""); setFilterDate(""); }}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <LoadingScreen />
      ) : (
        <Card className="overflow-hidden border-[#E3E0D8] bg-white shadow-sm">
          <CardContent className="p-0">
            {filteredFollowUps.length === 0 ? (
              <div className="py-12 text-center">
                <CalendarCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{followUps.length ? "No follow-ups match the current filters" : "No follow-ups scheduled"}</p>
              </div>
            ) : (
              <div className="space-y-6 p-4">
                {groupedFollowUps.map((group) => (
                  <div key={group.key} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-['Sora'] text-sm font-semibold text-[#18115E]">{group.label}</h3>
                      <span className="text-xs text-muted-foreground">{group.items.length} follow-up{group.items.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="overflow-hidden rounded-3xl border border-[#E3E0D8]">
                      <Table className="text-sm">
                        <TableHeader>
                          <TableRow className="bg-[#F8F7F4] hover:bg-[#F8F7F4]">
                            <TableHead className="w-[220px] font-semibold text-[#18115E]">Client</TableHead>
                            <TableHead className="w-[160px] font-semibold text-[#18115E]">Type</TableHead>
                            <TableHead className="w-[190px] font-semibold text-[#18115E]">Scheduled For</TableHead>
                            <TableHead className="w-[130px] font-semibold text-[#18115E]">Status</TableHead>
                            <TableHead className="font-semibold text-[#18115E]">Notes</TableHead>
                            <TableHead className="w-[160px] font-semibold text-[#18115E]">Created By</TableHead>
                            <TableHead className="w-[180px] text-right font-semibold text-[#18115E]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.items.map((followUp) => (
                            <TableRow
                              key={followUp.id}
                              data-testid={`followup-${followUp.id}`}
                              className="cursor-pointer"
                              onClick={() => openFollowUpDetail(followUp)}
                            >
                              <TableCell>
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                                    <Calendar className="h-4 w-4 text-primary" />
                                  </div>
                                  <span className="truncate font-medium">{getClientName(followUp.client_id)}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {followUp.type.replace(/-/g, " ")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{formatFollowUpSchedule(followUp)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusColors[followUp.status]}>
                                  {followUp.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <p className="max-w-[420px] truncate text-muted-foreground">
                                  {followUp.notes || "—"}
                                </p>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{followUp.created_by_name || "Coach"}</TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openFollowUpDetail(followUp);
                                    }}
                                  >
                                    View
                                  </Button>
                                  {followUp.status === "scheduled" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      data-testid={`complete-followup-${followUp.id}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        markComplete(followUp.id);
                                      }}
                                    >
                                      <CheckCircle className="w-4 h-4 mr-1" /> Complete
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="overflow-hidden border-0 bg-[#F5F4F0] p-0 shadow-2xl">
          <div className="border-b border-[#E3E0D8] bg-white/90 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="font-['Sora'] text-2xl text-[#18115E]">Schedule Follow-up</DialogTitle>
            <DialogDescription>Schedule a new follow-up with a client</DialogDescription>
          </DialogHeader>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date *</Label>
                <DatePickerInput
                  data-testid="followup-date-input"
                  value={formData.scheduled_date}
                  onChange={(value) => setFormData({ ...formData, scheduled_date: value })}
                  placeholder="Select follow-up date"
                  clearable={false}
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger data-testid="followup-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOW_UP_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea data-testid="followup-notes-input" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>
            <DialogFooter className="border-t border-[#E3E0D8] pt-4">
              <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="save-followup-btn" className="rounded-2xl bg-primary text-primary-foreground">Schedule</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedFollowUp}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedFollowUp(null);
            setFollowUpNoteDraft("");
          }
        }}
      >
        <DialogContent className="overflow-hidden border-0 bg-[#F5F4F0] p-0 shadow-2xl">
          <div className="border-b border-[#E3E0D8] bg-white/90 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="font-['Sora'] text-2xl text-[#18115E]">Follow-up Details</DialogTitle>
            <DialogDescription>View and edit follow-up notes from the full follow-up list.</DialogDescription>
          </DialogHeader>
          </div>

          {selectedFollowUp ? (
            <div className="space-y-5 px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-['Sora'] text-lg font-semibold text-[#18115E]">{getClientName(selectedFollowUp.client_id)}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selectedFollowUp.type.replace(/-/g, " ")} • {formatFollowUpSchedule(selectedFollowUp)}
                  </p>
                </div>
                <Badge variant="outline" className={statusColors[selectedFollowUp.status]}>
                  {selectedFollowUp.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Created by</p>
                  <p className="font-medium">{selectedFollowUp.created_by_name || "Coach"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created on</p>
                  <p className="font-medium">{formatDisplayDateTime(selectedFollowUp.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Follow-up date</p>
                  <p className="font-medium">{formatDisplayDate(selectedFollowUp.scheduled_date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Scheduled time</p>
                  <p className="font-medium">{selectedFollowUp.scheduled_time || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Completed on</p>
                  <p className="font-medium">{selectedFollowUp.completed_at ? formatDisplayDateTime(selectedFollowUp.completed_at) : "—"}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-[#E3E0D8] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Notes</p>
                  <Button variant="outline" size="sm" onClick={saveFollowUpNotes} disabled={noteSaving}>
                    {noteSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Save Notes
                  </Button>
                </div>
                <Textarea
                  rows={5}
                  value={followUpNoteDraft}
                  onChange={(event) => setFollowUpNoteDraft(event.target.value)}
                  className="mt-3"
                  placeholder="Add or edit follow-up notes"
                />
              </div>

              <DialogFooter className="justify-between">
                <div className="flex gap-2">
                  {selectedFollowUp.status === "scheduled" && (
                    <>
                      <Button variant="outline" onClick={() => updateFollowUpStatus(selectedFollowUp.id, "missed")} disabled={actionLoading}>
                        Mark Missed
                      </Button>
                      <Button variant="outline" onClick={() => updateFollowUpStatus(selectedFollowUp.id, "completed")} disabled={actionLoading}>
                        <CheckCircle className="w-4 h-4 mr-2" /> Mark Complete
                      </Button>
                    </>
                  )}
                </div>
                <Button variant="destructive" onClick={() => setDeleteTarget(selectedFollowUp)} disabled={actionLoading}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete follow-up record?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected follow-up from the full history list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteFollowUp} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
