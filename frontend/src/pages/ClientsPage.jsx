import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

const CLIENT_FORM_DEFAULTS = {
  name: "",
  age: "",
  gender: "",
  height_cm: "",
  diet_preference: "",
  email: "",
  phone: "",
  location: "",
  profession: "",
  about_client: "",
  health_issues: "",
  diet_start_date: "",
  diet_duration: "",
  diet_end_date: "",
  program_start_date: "",
  program_duration: "",
  pause_days: "",
  program_end_date: "",
  initial_weight_kg: "",
  current_weight_kg: "",
  goal_weight_kg: "",
  status: "active",
  primary_coach: "",
  sleep_quality: "",
  sleep_hours: "",
  morning_freshness: "",
  notes: "",
  recent_comment: "",
  last_follow_up_date: "",
  upcoming_follow_up_date: ""
};

const DURATION_OPTIONS = ["2 Weeks", "4 Weeks", "6 Weeks", "8 Weeks", "12 Weeks", "16 Weeks"];
const DIET_PREFERENCE_OPTIONS = ["Vegetarian", "Non Vegetarian", "Eggetarian", "Vegan", "Jain"];
const CLIENT_SORT_OPTIONS = [
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
  { value: "newest", label: "Newest Added" },
  { value: "recent-follow-up", label: "Recent Follow-up" }
];

const textOrNull = (value) => {
  const text = (value ?? "").toString().trim();
  return text || null;
};

const parseNullableInt = (value) => {
  const parsed = parseInt((value ?? "").toString().trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseNullableFloat = (value) => {
  const parsed = parseFloat((value ?? "").toString().replace(/[^\d.-]/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeToIsoDate = (value) => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const parseHeightToCm = (value) => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  const ftInMatch = raw.match(/(\d+)[^\d]+(\d+)/);
  if (ftInMatch) {
    const feet = parseInt(ftInMatch[1], 10);
    const inch = parseInt(ftInMatch[2], 10);
    if (!Number.isNaN(feet) && !Number.isNaN(inch)) {
      return +(feet * 30.48 + inch * 2.54).toFixed(1);
    }
  }
  return parseNullableFloat(raw);
};

const buildClientPayload = (source) => ({
  name: (source.name || "").trim(),
  email: textOrNull(source.email),
  phone: textOrNull(source.phone),
  location: textOrNull(source.location),
  profession: textOrNull(source.profession),
  age: parseNullableInt(source.age),
  gender: textOrNull(source.gender),
  diet_preference: textOrNull(source.diet_preference),
  primary_coach: textOrNull(source.primary_coach),
  height_cm: parseNullableFloat(source.height_cm),
  initial_weight_kg: parseNullableFloat(source.initial_weight_kg),
  current_weight_kg: parseNullableFloat(source.current_weight_kg),
  goal_weight_kg: parseNullableFloat(source.goal_weight_kg),
  status: textOrNull(source.status) || "active",
  about_client: textOrNull(source.about_client),
  health_issues: textOrNull(source.health_issues),
  recent_comment: textOrNull(source.recent_comment),
  diet_start_date: normalizeToIsoDate(source.diet_start_date),
  diet_duration: textOrNull(source.diet_duration),
  diet_end_date: normalizeToIsoDate(source.diet_end_date),
  program_start_date: normalizeToIsoDate(source.program_start_date),
  program_duration: textOrNull(source.program_duration),
  pause_days: parseNullableInt(source.pause_days),
  program_end_date: normalizeToIsoDate(source.program_end_date),
  sleep_quality: textOrNull(source.sleep_quality),
  sleep_hours: textOrNull(source.sleep_hours),
  morning_freshness: textOrNull(source.morning_freshness),
  notes: textOrNull(source.notes)
});

const parseCsvRows = (csvText) => {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        value += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((item) => item.trim() !== "")) rows.push(row);
  if (!rows.length) return [];

  const headerCounts = {};
  const headers = rows[0].map((header) => {
    const cleanHeader = header.trim();
    headerCounts[cleanHeader] = (headerCounts[cleanHeader] || 0) + 1;
    if (headerCounts[cleanHeader] === 1) return cleanHeader;
    return `${cleanHeader}__${headerCounts[cleanHeader]}`;
  });

  return rows.slice(1)
    .filter((r) => r.some((cell) => cell?.trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])));
};

const readCsvValue = (row, header) => {
  if (row[header]) return row[header];
  const candidates = Object.keys(row).filter((key) => key === header || key.startsWith(`${header}__`));
  for (const key of candidates) {
    if (row[key]) return row[key];
  }
  return "";
};

const pickDietFromCsv = (row) => {
  const keys = Object.keys(row).filter((key) => key === "Are you?" || key.startsWith("Are you?__"));
  const values = keys.map((key) => row[key]).filter(Boolean);
  const vegValue = values.find((item) => /veg|vegetarian|jain|vegan|egg/i.test(item));
  return vegValue || values[0] || "";
};

const mapCsvRowToClientPayload = (row) => {
  const healthProfile = readCsvValue(row, "How would you describe your health profile?");
  const healthConcern = readCsvValue(row, "Any specific known concern about your health?");
  const improvementGoal = readCsvValue(row, "What do you want to improve?");

  return buildClientPayload({
    name: readCsvValue(row, "Name"),
    phone: readCsvValue(row, "Phone"),
    location: readCsvValue(row, "Location"),
    profession: readCsvValue(row, "Profession"),
    age: readCsvValue(row, "Age"),
    email: readCsvValue(row, "Email"),
    height_cm: parseHeightToCm(readCsvValue(row, "Height")),
    initial_weight_kg: readCsvValue(row, "Weight"),
    current_weight_kg: readCsvValue(row, "Weight"),
    about_client: healthProfile || readCsvValue(row, "How is your lifestyle?"),
    health_issues: healthConcern,
    diet_preference: pickDietFromCsv(row),
    sleep_quality: readCsvValue(row, "How is your quality of sleep?"),
    morning_freshness: readCsvValue(row, "Do you feel fresh after waking up in the morning?"),
    sleep_hours: readCsvValue(row, "How many hours do you sleep?"),
    notes: [improvementGoal, readCsvValue(row, "Any major illness in the past?"), readCsvValue(row, "Genetic History")]
      .filter(Boolean)
      .join(" | ")
  });
};

const formatWeightDelta = (client) => {
  if (!client.initial_weight_kg || !client.current_weight_kg) return null;
  const delta = client.current_weight_kg - client.initial_weight_kg;
  return delta >= 0 ? `+${delta.toFixed(1)}kg` : `${delta.toFixed(1)}kg`;
};

export function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clientScope, setClientScope] = useState("active");
  const [sortBy, setSortBy] = useState("name-asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [formData, setFormData] = useState(CLIENT_FORM_DEFAULTS);
  const [rowDrafts, setRowDrafts] = useState({});
  const csvInputRef = useRef(null);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await api.get("/clients");
      setClients(res.data);
      const drafts = {};
      res.data.forEach((client) => {
        drafts[client.id] = {
          recent_comment: client.recent_comment || "",
          diet_start_date: client.diet_start_date || "",
          diet_end_date: client.diet_end_date || "",
          last_follow_up_date: client.last_follow_up_date || "",
          upcoming_follow_up_date: client.upcoming_follow_up_date || ""
        };
      });
      setRowDrafts(drafts);
    } catch (err) {
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const resetForm = () => setFormData(CLIENT_FORM_DEFAULTS);

  const openCreateDialog = () => {
    resetForm();
    setEditingClient(null);
    setDialogOpen(true);
  };

  const openEditDialog = (client) => {
    setEditingClient(client);
    setFormData({
      ...CLIENT_FORM_DEFAULTS,
      ...Object.fromEntries(Object.entries(client).map(([key, value]) => [key, value ?? ""])),
      age: client.age?.toString() || "",
      height_cm: client.height_cm?.toString() || "",
      initial_weight_kg: client.initial_weight_kg?.toString() || "",
      current_weight_kg: client.current_weight_kg?.toString() || "",
      goal_weight_kg: client.goal_weight_kg?.toString() || "",
      pause_days: client.pause_days?.toString() || ""
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = buildClientPayload(formData);
      if (!payload.name) {
        toast.error("Client name is required");
        return;
      }

      if (editingClient) {
        await api.put(`/clients/${editingClient.id}`, payload);
        toast.success("Client updated successfully");
      } else {
        await api.post("/clients", payload);
        toast.success("Client added successfully");
      }

      setDialogOpen(false);
      setEditingClient(null);
      resetForm();
      fetchClients();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save client");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this client?")) return;
    try {
      await api.delete(`/clients/${id}`);
      toast.success("Client deleted");
      fetchClients();
    } catch (err) {
      toast.error("Failed to delete client");
    }
  };

  const saveInlineField = async (clientId, field, rawValue) => {
    try {
      const value = field.includes("date") ? normalizeToIsoDate(rawValue) : textOrNull(rawValue);
      await api.put(`/clients/${clientId}`, { [field]: value });
      setClients((prev) => prev.map((client) => (client.id === clientId ? { ...client, [field]: value } : client)));
    } catch (err) {
      toast.error("Failed to update client");
    }
  };

  const updateStatus = async (clientId, status) => {
    try {
      await api.put(`/clients/${clientId}`, { status });
      setClients((prev) => prev.map((client) => (client.id === clientId ? { ...client, status } : client)));
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const triggerCsvPicker = () => {
    if (csvImporting) return;
    csvInputRef.current?.click();
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setCsvImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsvRows(text);
      if (!rows.length) {
        toast.error("CSV looks empty");
        return;
      }

      const payloads = rows.map(mapCsvRowToClientPayload).filter((payload) => payload.name);
      if (!payloads.length) {
        toast.error("No valid rows found in CSV");
        return;
      }

      let success = 0;
      let failed = 0;
      for (const payload of payloads) {
        try {
          await api.post("/clients", payload);
          success += 1;
        } catch (err) {
          failed += 1;
        }
      }

      if (success > 0) toast.success(`${success} client${success > 1 ? "s" : ""} imported`);
      if (failed > 0) toast.error(`${failed} row${failed > 1 ? "s" : ""} failed during import`);
      fetchClients();
    } catch (err) {
      toast.error("Failed to parse CSV");
    } finally {
      setCsvImporting(false);
    }
  };

  const activeCount = clients.filter((client) => client.status === "active").length;
  const totalCount = clients.length;

  const visibleClients = clients
    .filter((client) => {
      if (clientScope === "active" && client.status !== "active") return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [client.name, client.email, client.phone].some((field) => (field || "").toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === "name-desc") return (b.name || "").localeCompare(a.name || "");
      if (sortBy === "newest") return (b.created_at || "").localeCompare(a.created_at || "");
      if (sortBy === "recent-follow-up") return (b.last_follow_up_date || "").localeCompare(a.last_follow_up_date || "");
      return (a.name || "").localeCompare(b.name || "");
    });

  return (
    <div className="space-y-6 animate-fade-in" data-testid="clients-page">
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleCsvUpload}
      />

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Client Tracker</h1>
          <p className="text-muted-foreground mt-1">Stay on top of every client touchpoint and upcoming follow-up.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreateDialog} data-testid="add-client-btn" className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Client
          </Button>
          <Button variant="outline">
            <Sparkles className="w-4 h-4 mr-2" /> Ask AI
          </Button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-3">
        <div className="flex rounded-xl border border-border/50 bg-muted/20 p-1">
          <button
            type="button"
            onClick={() => setClientScope("active")}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${clientScope === "active" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Active Clients ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setClientScope("all")}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${clientScope === "all" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            All Clients ({totalCount})
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full xl:w-60 h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLIENT_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/40 bg-card/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] table-fixed">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="table-dense text-left w-[220px]">Client</th>
                <th className="table-dense text-left w-[190px]">Status</th>
                <th className="table-dense text-left w-[260px]">Recent Comment</th>
                <th className="table-dense text-left w-[180px]">Diet Start</th>
                <th className="table-dense text-left w-[180px]">Diet Expire</th>
                <th className="table-dense text-left w-[180px]">Last Follow-up</th>
                <th className="table-dense text-left w-[210px]">Upcoming Follow-up</th>
                <th className="table-dense text-left w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-muted-foreground">Loading clients...</td>
                </tr>
              ) : visibleClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-muted-foreground">No clients found for this filter.</td>
                </tr>
              ) : (
                visibleClients.map((client) => {
                  const draft = rowDrafts[client.id] || {};
                  const delta = formatWeightDelta(client);
                  return (
                    <tr key={client.id} className="table-dense align-top" data-testid={`client-row-${client.id}`}>
                      <td>
                        <Link to={`/clients/${client.id}`} className="font-semibold text-primary hover:underline">
                          {client.name}
                        </Link>
                        <p className="text-sm text-muted-foreground mt-1">
                          {client.initial_weight_kg || "—"} kg → {client.current_weight_kg || client.initial_weight_kg || "—"} kg{" "}
                          {delta && <span className={delta.startsWith("-") ? "text-green-500 font-semibold" : "text-red-400 font-semibold"}>({delta})</span>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Last log: {client.updated_at ? client.updated_at.slice(0, 10) : "—"}</p>
                      </td>
                      <td>
                        <select
                          className="w-full h-10 rounded-md border border-border/50 bg-background px-3 text-sm"
                          value={client.status || "active"}
                          onChange={(e) => updateStatus(client.id, e.target.value)}
                        >
                          <option value="active">Active</option>
                          <option value="on-hold">On Hold</option>
                          <option value="completed">Completed</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td>
                        <Input
                          value={draft.recent_comment ?? ""}
                          onChange={(e) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], recent_comment: e.target.value } }))}
                          onBlur={(e) => saveInlineField(client.id, "recent_comment", e.target.value)}
                          placeholder="Add comment"
                        />
                      </td>
                      <td>
                        <Input
                          type="date"
                          value={draft.diet_start_date ?? ""}
                          onChange={(e) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], diet_start_date: e.target.value } }))}
                          onBlur={(e) => saveInlineField(client.id, "diet_start_date", e.target.value)}
                        />
                      </td>
                      <td>
                        <Input
                          type="date"
                          value={draft.diet_end_date ?? ""}
                          onChange={(e) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], diet_end_date: e.target.value } }))}
                          onBlur={(e) => saveInlineField(client.id, "diet_end_date", e.target.value)}
                        />
                      </td>
                      <td>
                        <Input
                          type="date"
                          value={draft.last_follow_up_date ?? ""}
                          onChange={(e) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], last_follow_up_date: e.target.value } }))}
                          onBlur={(e) => saveInlineField(client.id, "last_follow_up_date", e.target.value)}
                        />
                      </td>
                      <td>
                        <Input
                          type="date"
                          value={draft.upcoming_follow_up_date ?? ""}
                          onChange={(e) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], upcoming_follow_up_date: e.target.value } }))}
                          onBlur={(e) => saveInlineField(client.id, "upcoming_follow_up_date", e.target.value)}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(client)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(client.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-3xl font-['Manrope']">{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
            <DialogDescription>
              {editingClient ? "Update detailed client profile information" : "Add manually or import from CSV sample"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-7">
            {!editingClient && (
              <div className="space-y-3">
                <Label>Import from CSV</Label>
                <Button type="button" variant="outline" onClick={triggerCsvPicker} disabled={csvImporting}>
                  <Upload className="w-4 h-4 mr-2" />
                  {csvImporting ? "Importing..." : "Upload Client CSV"}
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input data-testid="client-name-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter full name" required />
              </div>
              <div className="space-y-2">
                <Label>Age *</Label>
                <Input type="number" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} placeholder="Enter age" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <div className="flex items-center gap-6 h-11 px-3 rounded-md border border-border/50">
                  {["male", "female", "other"].map((gender) => (
                    <label key={gender} className="flex items-center gap-2 text-sm capitalize">
                      <input type="radio" name="gender" checked={formData.gender === gender} onChange={() => setFormData({ ...formData, gender })} />
                      {gender}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Height (cm)</Label>
                <Input value={formData.height_cm} onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })} placeholder="Enter height" />
              </div>
              <div className="space-y-2">
                <Label>Diet Preference</Label>
                <Select value={formData.diet_preference || "none"} onValueChange={(value) => setFormData({ ...formData, diet_preference: value === "none" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select diet preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {DIET_PREFERENCE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Enter email address" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Enter phone number" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>About Client</Label>
              <Textarea value={formData.about_client} onChange={(e) => setFormData({ ...formData, about_client: e.target.value })} placeholder="Brief description about the client" />
            </div>

            <div className="space-y-2">
              <Label>Health Issues</Label>
              <Input value={formData.health_issues} onChange={(e) => setFormData({ ...formData, health_issues: e.target.value })} placeholder="Enter health issues (comma separated)" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Diet Start Date</Label>
                <Input type="date" value={formData.diet_start_date} onChange={(e) => setFormData({ ...formData, diet_start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Diet Duration</Label>
                <Select value={formData.diet_duration || "none"} onValueChange={(value) => setFormData({ ...formData, diet_duration: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {DURATION_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Diet End Date</Label>
                <Input type="date" value={formData.diet_end_date} onChange={(e) => setFormData({ ...formData, diet_end_date: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Program Start Date</Label>
                <Input type="date" value={formData.program_start_date} onChange={(e) => setFormData({ ...formData, program_start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Program Duration</Label>
                <Select value={formData.program_duration || "none"} onValueChange={(value) => setFormData({ ...formData, program_duration: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {DURATION_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pause Days</Label>
                <Input type="number" value={formData.pause_days} onChange={(e) => setFormData({ ...formData, pause_days: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Program End Date</Label>
                <Input type="date" value={formData.program_end_date} onChange={(e) => setFormData({ ...formData, program_end_date: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Weight (kg) *</Label>
                <Input type="number" step="0.1" value={formData.initial_weight_kg} onChange={(e) => setFormData({ ...formData, initial_weight_kg: e.target.value })} placeholder="Enter start weight" />
              </div>
              <div className="space-y-2">
                <Label>Target Weight (kg) *</Label>
                <Input type="number" step="0.1" value={formData.goal_weight_kg} onChange={(e) => setFormData({ ...formData, goal_weight_kg: e.target.value })} placeholder="Enter target weight" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status || "active"} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Primary Coach</Label>
                <Input value={formData.primary_coach} onChange={(e) => setFormData({ ...formData, primary_coach: e.target.value })} placeholder="Select primary coach" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="City" />
              </div>
              <div className="space-y-2">
                <Label>Profession</Label>
                <Input value={formData.profession} onChange={(e) => setFormData({ ...formData, profession: e.target.value })} placeholder="Profession" />
              </div>
              <div className="space-y-2">
                <Label>Recent Team Comment</Label>
                <Input value={formData.recent_comment} onChange={(e) => setFormData({ ...formData, recent_comment: e.target.value })} placeholder="Add comment" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground">
                {editingClient ? "Update Client" : "Add Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
