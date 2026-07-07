import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Phone, MapPin, Trash2, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/app/LoadingScreen";

// Pipeline stages, in board order. `key` is what we expect the API to store.
const STAGES = [
  { key: "new", label: "New" },
  { key: "call-booked", label: "Call Booked" },
  { key: "consultation-done", label: "Consultation Done" },
  { key: "follow-up", label: "Follow-up" },
  { key: "plan-next-month", label: "Plan For Next Month" },
  { key: "converted", label: "Converted" },
];

const STAGE_LABELS = STAGES.map((s) => s.label);

const LEAD_FORM_DEFAULTS = { name: "", phone: "", location: "", source: "", stage: "new" };

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey) {
  const [y, m] = (monthKey || "").split("-").map(Number);
  if (!y || !m) return "";
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonthKey());
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(LEAD_FORM_DEFAULTS);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadLeads = () => {
    setLoading(true);
    // ASSUMED ENDPOINT: GET /leads?month=YYYY-MM  -> array of leads.
    // Fails soft: an empty board renders instead of an error screen.
    api.get(`/leads?month=${month}`)
      .then((res) => setLeads(Array.isArray(res.data) ? res.data : res.data?.leads || []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  };

  useEffect(loadLeads, [month]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.phone, l.source, l.location].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
  }, [leads, search]);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(STAGES.map((s) => [s.key, []]));
    filtered.forEach((lead) => {
      const key = (lead.stage || "new").toLowerCase();
      (map[key] || map.new).push(lead);
    });
    return map;
  }, [filtered]);

  const stats = useMemo(() => {
    const total = leads.length;
    const converted = leads.filter((l) => (l.stage || "").toLowerCase() === "converted").length;
    const followUp = leads.filter((l) => (l.stage || "").toLowerCase() === "follow-up").length;
    const nextMonth = leads.filter((l) => (l.stage || "").toLowerCase() === "plan-next-month").length;
    const active = total - converted;
    return { total, active, followUp, nextMonth, converted };
  }, [leads]);

  const openCreate = () => { setForm(LEAD_FORM_DEFAULTS); setEditingId(null); setDialogOpen(true); };
  const openEdit = (lead) => {
    setForm({
      name: lead.name || "", phone: lead.phone || "", location: lead.location || "",
      source: lead.source || "", stage: (lead.stage || "new").toLowerCase(),
    });
    setEditingId(lead.id);
    setDialogOpen(true);
  };

  const saveLead = async () => {
    if (!form.name.trim()) { toast.error("Lead name is required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, month };
      if (editingId) {
        await api.put(`/leads/${editingId}`, payload); // ASSUMED: PUT /leads/:id
        toast.success("Lead updated");
      } else {
        await api.post("/leads", payload); // ASSUMED: POST /leads
        toast.success("Lead added");
      }
      setDialogOpen(false);
      loadLeads();
    } catch (err) {
      toast.error("Couldn't save the lead");
    }
    setSaving(false);
  };

  const deleteLead = async (id) => {
    try {
      await api.delete(`/leads/${id}`); // ASSUMED: DELETE /leads/:id
      setLeads((prev) => prev.filter((l) => l.id !== id));
      toast.success("Lead removed");
    } catch (err) {
      toast.error("Couldn't remove the lead");
    }
  };

  if (loading) return <LoadingScreen />;

  const statPills = [
    { label: "Monthly Leads", value: stats.total },
    { label: "Active", value: stats.active },
    { label: "Follow-up", value: stats.followUp },
    { label: "Next Month", value: stats.nextMonth },
    { label: "Converted", value: stats.converted },
  ];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="leads-page">
      <Card className="p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipeline</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{monthLabel(month)} Leads</h1>
            <p className="mt-1 text-muted-foreground">Manage this month's enquiries from first contact to conversion.</p>
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lead Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-11 w-44" />
            </div>
            <Button onClick={openCreate} data-testid="add-lead-btn" className="h-11">
              <Plus className="mr-2 h-4 w-4" /> Add Lead
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {statPills.map((pill) => (
            <div key={pill.label} className="rounded-lg bg-accent/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{pill.label}</p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">{pill.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={`Search ${monthLabel(month)} leads by name, source, phone`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 pl-10"
        />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {STAGES.map((stage) => {
          const items = byStage[stage.key] || [];
          return (
            <div key={stage.key} className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={stage.label} label={stage.label} dot />
                </div>
                <span className="text-sm font-semibold text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No leads</p>
                ) : (
                  items.map((lead) => (
                    <Card key={lead.id} className="p-3 shadow-xs" data-testid={`lead-card-${lead.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-foreground">{lead.name}</p>
                        <StatusBadge status={stage.label} label={stage.label} className="shrink-0" />
                      </div>
                      {lead.phone && (
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" /> {lead.phone}
                        </p>
                      )}
                      {lead.location && (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" /> {lead.location}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                        <span className="text-xs text-muted-foreground">{lead.source || "No source"}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(lead)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-primary" aria-label="Edit lead">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteLead(lead.id)} className="rounded p-1 text-muted-foreground hover:bg-danger-bg hover:text-danger" aria-label="Delete lead">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">{editingId ? "Edit Lead" : "Add Lead"}</DialogTitle>
            <DialogDescription>Capture an enquiry and place it on the pipeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lead name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 ..." />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Source</Label>
                <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Instagram, referral…" />
              </div>
              <div className="space-y-2">
                <Label>Stage</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveLead} disabled={saving}>{saving ? "Saving…" : editingId ? "Save" : "Add Lead"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { STAGE_LABELS };
