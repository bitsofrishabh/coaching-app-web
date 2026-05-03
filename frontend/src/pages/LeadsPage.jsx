import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Mail, MapPin, Phone, Plus, Search, Trash2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { api } from "@/lib/api";

const LEAD_STATUSES = [
  { key: "new", label: "New", tone: "gray" },
  { key: "contacted", label: "Contacted", tone: "blue" },
  { key: "consultation-booked", label: "Consultation Booked", tone: "violet" },
  { key: "follow-up", label: "Follow-up", tone: "amber" },
  { key: "converted", label: "Converted", tone: "green" },
  { key: "lost", label: "Lost", tone: "red" },
];

const LEAD_STATUS_META = {
  new: "text-sky-600 dark:text-sky-300",
  contacted: "text-violet-600 dark:text-violet-300",
  "consultation-booked": "text-emerald-600 dark:text-emerald-300",
  "follow-up": "text-amber-600 dark:text-amber-300",
  converted: "text-green-600 dark:text-green-300",
  lost: "text-red-500 dark:text-red-300",
};

const LEAD_FORM_DEFAULTS = {
  name: "",
  phone: "",
  email: "",
  age: "",
  gender: "",
  location: "",
  source: "",
  status: "new",
  notes: "",
  last_contacted_date: "",
  next_follow_up_date: "",
  assigned_to: "",
};

const formatDisplayDate = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const buildLeadPayload = (source) => ({
  name: source.name.trim(),
  phone: source.phone.trim() || null,
  email: source.email.trim() || null,
  age: source.age ? Number(source.age) : null,
  gender: source.gender || null,
  location: source.location.trim() || null,
  source: source.source.trim() || null,
  status: source.status || "new",
  notes: source.notes.trim() || null,
  last_contacted_date: source.last_contacted_date || null,
  next_follow_up_date: source.next_follow_up_date || null,
  assigned_to: source.assigned_to.trim() || null,
});

const leadToFormData = (lead = {}) => ({
  ...LEAD_FORM_DEFAULTS,
  ...Object.fromEntries(Object.entries(lead).map(([key, value]) => [key, value ?? ""])),
  age: lead.age?.toString() || "",
});

export function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [formData, setFormData] = useState(LEAD_FORM_DEFAULTS);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const response = await api.get("/leads");
      setLeads(response.data || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const openCreateDialog = () => {
    setEditingLead(null);
    setFormData(LEAD_FORM_DEFAULTS);
    setDialogOpen(true);
  };

  const openEditDialog = (lead) => {
    setEditingLead(lead);
    setFormData(leadToFormData(lead));
    setDialogOpen(true);
  };

  const syncLeadIntoState = (savedLead) => {
    setLeads((current) => {
      const exists = current.some((lead) => lead.id === savedLead.id);
      if (!exists) return [savedLead, ...current];
      return current.map((lead) => (lead.id === savedLead.id ? savedLead : lead));
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = buildLeadPayload(formData);
    if (!payload.name) {
      toast.error("Lead name is required");
      return;
    }
    if (Number.isNaN(payload.age)) {
      toast.error("Age must be a valid number");
      return;
    }

    try {
      const response = editingLead
        ? await api.put(`/leads/${editingLead.id}`, payload)
        : await api.post("/leads", payload);
      syncLeadIntoState(response.data);
      setDialogOpen(false);
      setEditingLead(null);
      setFormData(LEAD_FORM_DEFAULTS);
      toast.success(editingLead ? "Lead updated" : "Lead added");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save lead");
    }
  };

  const handleDeleteLead = async (lead) => {
    try {
      await api.delete(`/leads/${lead.id}`);
      setLeads((current) => current.filter((item) => item.id !== lead.id));
      toast.success("Lead deleted");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete lead");
    }
  };

  const handleLeadStatusMove = async (lead, nextStatus) => {
    const previousStatus = lead.status || "new";
    setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, status: nextStatus } : item)));
    try {
      await api.put(`/leads/${lead.id}`, { status: nextStatus });
      toast.success(`${lead.name} moved`);
    } catch (error) {
      setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, status: previousStatus } : item)));
      toast.error(error.response?.data?.detail || "Failed to update lead");
    }
  };

  const filteredLeads = leads.filter((lead) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return [lead.name, lead.phone, lead.email, lead.source, lead.location]
      .some((field) => (field || "").toLowerCase().includes(query));
  });

  return (
    <div className="space-y-6 animate-fade-in" data-testid="leads-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Leads</h1>
          <p className="mt-1 text-muted-foreground">Manage new enquiries from first contact to conversion.</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-primary text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" />
          Add Lead
        </Button>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search leads by name, source, phone"
          className="h-11 pl-10"
        />
      </div>

      {loading ? (
        <div className="rounded-lg border border-border/60 p-8 text-center text-sm text-muted-foreground">Loading leads...</div>
      ) : (
        <KanbanBoard
          columns={LEAD_STATUSES}
          items={filteredLeads}
          getItemId={(lead) => lead.id}
          getItemStatus={(lead) => lead.status || "new"}
          onItemStatusChange={handleLeadStatusMove}
          emptyLabel="No leads"
          renderCard={(lead) => (
            <div className="rounded-lg border border-border/70 bg-background p-3 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => openEditDialog(lead)} className="min-w-0 text-left text-sm font-semibold hover:text-primary">
                  <span className="block truncate">{lead.name}</span>
                </button>
                <Badge variant="outline" className={`shrink-0 border-border/70 ${LEAD_STATUS_META[lead.status] || ""}`}>
                  {LEAD_STATUSES.find((status) => status.key === lead.status)?.label || lead.status}
                </Badge>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                {lead.phone ? (
                  <p className="flex items-center gap-2 truncate">
                    <Phone className="h-3.5 w-3.5" />
                    <span className="truncate">{lead.phone}</span>
                  </p>
                ) : null}
                {lead.email ? (
                  <p className="flex items-center gap-2 truncate">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{lead.email}</span>
                  </p>
                ) : null}
                {lead.location ? (
                  <p className="flex items-center gap-2 truncate">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{lead.location}</span>
                  </p>
                ) : null}
                {lead.next_follow_up_date ? (
                  <p className="flex items-center gap-2 truncate">
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span className="truncate">Next: {formatDisplayDate(lead.next_follow_up_date)}</span>
                  </p>
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs text-muted-foreground">{lead.source || "No source"}</span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => openEditDialog(lead)}>
                    Edit
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteLead(lead)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingLead ? "Edit Lead" : "Add Lead"}</DialogTitle>
            <DialogDescription>Capture the basics and move the lead through the pipeline.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((status) => (
                      <SelectItem key={status.key} value={status.key}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Age</Label>
                <Input type="number" value={formData.age} onChange={(event) => setFormData({ ...formData, age: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={formData.gender || "none"} onValueChange={(value) => setFormData({ ...formData, gender: value === "none" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={formData.location} onChange={(event) => setFormData({ ...formData, location: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Lead Source</Label>
                <Input value={formData.source} onChange={(event) => setFormData({ ...formData, source: event.target.value })} placeholder="Instagram, referral, website" />
              </div>
              <div className="space-y-2">
                <Label>Last Contacted</Label>
                <Input type="date" value={formData.last_contacted_date} onChange={(event) => setFormData({ ...formData, last_contacted_date: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Next Follow-up</Label>
                <Input type="date" value={formData.next_follow_up_date} onChange={(event) => setFormData({ ...formData, next_follow_up_date: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Assigned To</Label>
                <Input value={formData.assigned_to} onChange={(event) => setFormData({ ...formData, assigned_to: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea rows={4} value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">
                <UserRound className="mr-2 h-4 w-4" />
                {editingLead ? "Save Lead" : "Create Lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
