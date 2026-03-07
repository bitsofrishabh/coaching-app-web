import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, CalendarCheck, Calendar, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/app/LoadingScreen";

export function FollowUpsPage() {
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
        <Button data-testid="schedule-followup-btn" onClick={() => setDialogOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow">
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
                        <Button size="sm" variant="outline" data-testid={`complete-followup-${followUp.id}`} onClick={() => markComplete(followUp.id)}>
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
                  <SelectItem value="check-in">Check-in</SelectItem>
                  <SelectItem value="weigh-in">Weigh-in</SelectItem>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="progress-review">Progress Review</SelectItem>
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
    </div>
  );
}
