import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, CalendarCheck, Calendar, CheckCircle, Loader2, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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

export function FollowUpsPage() {
  const [followUps, setFollowUps] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ client_id: "", scheduled_date: "", type: "check-in", notes: "" });
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
      api.get("/clients")
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
      setFormData({ client_id: "", scheduled_date: "", type: "check-in", notes: "" });
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

  const filteredFollowUps = followUps.filter((followUp) => {
    const clientName = getClientName(followUp.client_id).toLowerCase();
    const matchesClient = !searchQuery.trim() || clientName.includes(searchQuery.trim().toLowerCase());
    const matchesDate = !filterDate || (followUp.scheduled_date || "").slice(0, 10) === filterDate;
    return matchesClient && matchesDate;
  });

  return (
    <div className="space-y-6 animate-fade-in" data-testid="follow-ups-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Follow-ups</h1>
          <p className="text-muted-foreground mt-1">Schedule and track client follow-ups</p>
        </div>
        <Button data-testid="schedule-followup-btn" onClick={() => setDialogOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow">
          <Plus className="w-4 h-4 mr-2" /> Schedule Follow-up
        </Button>
      </div>

      {!loading && (
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Filter by client name"
                  className="pl-9"
                />
              </div>
              <Input
                type="date"
                value={filterDate}
                onChange={(event) => setFilterDate(event.target.value)}
              />
              <Button variant="outline" onClick={() => { setSearchQuery(""); setFilterDate(""); }}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <LoadingScreen />
      ) : (
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-0">
            {filteredFollowUps.length === 0 ? (
              <div className="py-12 text-center">
                <CalendarCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{followUps.length ? "No follow-ups match the current filters" : "No follow-ups scheduled"}</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredFollowUps.map((followUp) => (
                  <button
                    key={followUp.id}
                    type="button"
                    className="w-full flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors text-left"
                    data-testid={`followup-${followUp.id}`}
                    onClick={() => openFollowUpDetail(followUp)}
                  >
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{getClientName(followUp.client_id)}</p>
                        <Badge variant="outline" className="text-xs">{followUp.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{formatDisplayDate(followUp.scheduled_date)}</p>
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
                          onClick={(event) => {
                            event.stopPropagation();
                            markComplete(followUp.id);
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Complete
                        </Button>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              <Input type="date" data-testid="followup-date-input" value={formData.scheduled_date} onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })} required />
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="save-followup-btn" className="bg-primary text-primary-foreground">Schedule</Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-['Manrope']">Follow-up Details</DialogTitle>
            <DialogDescription>View and edit follow-up notes from the full follow-up list.</DialogDescription>
          </DialogHeader>

          {selectedFollowUp ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{getClientName(selectedFollowUp.client_id)}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selectedFollowUp.type.replace(/-/g, " ")} • {formatDisplayDate(selectedFollowUp.scheduled_date)}
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
                  <p className="text-muted-foreground">Completed on</p>
                  <p className="font-medium">{selectedFollowUp.completed_at ? formatDisplayDateTime(selectedFollowUp.completed_at) : "—"}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border/40 p-4">
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
