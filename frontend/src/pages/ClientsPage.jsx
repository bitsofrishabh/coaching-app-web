import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

const CLIENT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on-hold", label: "Paused" },
  { value: "inactive", label: "Stopped" },
  { value: "completed", label: "Program Done" },
  { value: "out-of-town", label: "Out of Town" }
];

const CLIENT_STATUS_META = {
  active: {
    label: "Active",
    dotClassName: "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]"
  },
  "on-hold": {
    label: "Paused",
    dotClassName: "bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.16)]"
  },
  inactive: {
    label: "Stopped",
    dotClassName: "bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.14)]"
  },
  completed: {
    label: "Program Done",
    dotClassName: "bg-violet-500 shadow-[0_0_0_4px_rgba(139,92,246,0.16)]"
  },
  "out-of-town": {
    label: "Out of Town",
    dotClassName: "bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.16)]"
  }
};

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
  const feetDotInchesMatch = raw.match(/^(\d)\.(\d{1,2})$/);
  if (feetDotInchesMatch) {
    const feet = parseInt(feetDotInchesMatch[1], 10);
    const inch = parseInt(feetDotInchesMatch[2], 10);
    if (!Number.isNaN(feet) && !Number.isNaN(inch) && inch < 12) {
      return +(feet * 30.48 + inch * 2.54).toFixed(1);
    }
  }
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

const clientPayloadToFormData = (source = {}) => ({
  ...CLIENT_FORM_DEFAULTS,
  ...Object.fromEntries(Object.entries(source).map(([key, value]) => [key, value ?? ""])),
  age: source.age?.toString() || "",
  height_cm: source.height_cm?.toString() || "",
  initial_weight_kg: source.initial_weight_kg?.toString() || "",
  current_weight_kg: source.current_weight_kg?.toString() || "",
  goal_weight_kg: source.goal_weight_kg?.toString() || "",
  pause_days: source.pause_days?.toString() || "",
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
  const keys = Object.keys(row).filter((key) => key === "Are you?" || key.startsWith("Are you?__") || normalizeHeaderKey(key) === "dietpreference");
  const values = keys.map((key) => row[key]).filter(Boolean);
  const vegValue = values.find((item) => /veg|vegetarian|jain|vegan|egg/i.test(item));
  return vegValue || values[0] || "";
};

const mapCsvRowToClientPayload = (row) => {
  const healthProfile = readCsvValueByAliases(row, ["About Client", "How would you describe your health profile?", "How is your lifestyle?", "Lifestyle"]);
  const healthConcern = readCsvValueByAliases(row, ["Health Issues", "Any specific known concern about your health?", "Health Concern", "What do you suffer from?"]);
  const improvementGoal = readCsvValueByAliases(row, ["What do you want to improve?", "What are you looking to improve in your Health?", "Improvement Goal", "Goal"]);
  const medication = readCsvValueByAliases(row, ["Are you taking any medication currently", "Are you taking any medication currently?"]);
  const fatherHistory = readCsvValueByAliases(row, ["Father's Medical History"]);
  const motherHistory = readCsvValueByAliases(row, ["Mother's Medical History"]);
  const physicalActivity = readCsvValueByAliases(row, ["Do you indulge in any physical activity?", "If Yes, What Activity and how many times a week?"]);
  const activityMinutes = readCsvValueByAliases(row, ["How many minutes in a day do you indulge in general Activity?"]);
  const workStress = readCsvValueByAliases(row, ["How would you describe your official stress?"]);
  const waterIntake = readCsvValueByAliases(row, ["How many liters of water do you drink in a day?"]);
  const hairCondition = readCsvValueByAliases(row, ["Do you suffer from any specific hair condition like?"]);
  const mealTimes = [
    ["Wake Up", readCsvValueByAliases(row, ["What time do you wake up?"])],
    ["Breakfast", readCsvValueByAliases(row, ["What time do you eat your breakfast?"])],
    ["Lunch", readCsvValueByAliases(row, ["What time do you eat your lunch?"])],
    ["Evening Snack", readCsvValueByAliases(row, ["What time do you eat your evening snacks?"])],
    ["Dinner", readCsvValueByAliases(row, ["What time do you eat your dinner?"])],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join(", ");

  return buildClientPayload({
    name: readCsvValueByAliases(row, ["Name", "Full Name", "Client Name"]),
    phone: readCsvValueByAliases(row, ["Phone", "Phone Number", "Mobile", "Contact Number"]),
    location: readCsvValueByAliases(row, ["Location", "City", "Address"]),
    profession: readCsvValueByAliases(row, ["Profession", "Occupation"]),
    age: readCsvValueByAliases(row, ["Age"]),
    gender: readCsvValueByAliases(row, ["Gender", "Sex"]),
    email: readCsvValueByAliases(row, ["Email", "Email Address"]),
    height_cm: parseHeightToCm(readCsvValueByAliases(row, ["Height", "Height (cm)", "Height Cm"])),
    initial_weight_kg: readCsvValueByAliases(row, ["Start Weight", "Initial Weight", "Weight"]),
    current_weight_kg: readCsvValueByAliases(row, ["Current Weight", "Weight"]),
    goal_weight_kg: readCsvValueByAliases(row, ["Target Weight", "Goal Weight", "Desired Weight"]),
    about_client: healthProfile || readCsvValueByAliases(row, ["How is your lifestyle?"]),
    health_issues: healthConcern,
    diet_preference: pickDietFromCsv(row),
    primary_coach: readCsvValueByAliases(row, ["Primary Coach", "Coach", "Task Owner"]),
    status: mapNotionStatus(readCsvValueByAliases(row, ["Status"])),
    diet_start_date: readCsvValueByAliases(row, ["Diet Start", "Diet Start Date"]),
    diet_end_date: readCsvValueByAliases(row, ["Diet Expire", "Diet End", "Diet End Date"]),
    program_start_date: readCsvValueByAliases(row, ["Program Start Date", "Program Started Date"]),
    program_end_date: readCsvValueByAliases(row, ["Program End Date"]),
    last_follow_up_date: readCsvValueByAliases(row, ["Last Follow-up", "Last Follow up"]),
    upcoming_follow_up_date: readCsvValueByAliases(row, ["Upcoming Follow-up", "Next Follow-up", "Next Follow up", "Expected Date"]),
    sleep_quality: readCsvValueByAliases(row, ["How is your quality of sleep?", "Sleep Quality"]),
    morning_freshness: readCsvValueByAliases(row, ["Do you feel fresh after waking up in the morning?", "Morning Freshness"]),
    sleep_hours: readCsvValueByAliases(row, ["How many hours do you sleep?", "Sleep Hours"]),
    recent_comment: readCsvValueByAliases(row, ["Recent Comment", "Comment", "Action Items"]),
    notes: [
      improvementGoal ? `Improve: ${improvementGoal}` : "",
      medication ? `Medication: ${medication}` : "",
      readCsvValueByAliases(row, ["Any major illness in the past?", "Past Illness"]) ? `Past Illness: ${readCsvValueByAliases(row, ["Any major illness in the past?", "Past Illness"])}` : "",
      readCsvValueByAliases(row, ["Genetic History"]) ? `Genetic History: ${readCsvValueByAliases(row, ["Genetic History"])}` : "",
      fatherHistory ? `Father History: ${fatherHistory}` : "",
      motherHistory ? `Mother History: ${motherHistory}` : "",
      physicalActivity ? `Physical Activity: ${physicalActivity}` : "",
      activityMinutes ? `General Activity: ${activityMinutes}` : "",
      workStress ? `Work Stress: ${workStress}` : "",
      waterIntake ? `Water Intake: ${waterIntake}` : "",
      hairCondition ? `Hair Condition: ${hairCondition}` : "",
      mealTimes ? `Meal Times: ${mealTimes}` : "",
      readCsvValueByAliases(row, ["Notes"]) ? `Notes: ${readCsvValueByAliases(row, ["Notes"])}` : "",
    ]
      .filter(Boolean)
      .join(" | ")
  });
};

const normalizeHeaderKey = (value) => (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const readCsvValueByAliases = (row, aliases) => {
  const normalizedAliases = aliases.map(normalizeHeaderKey);
  for (const [key, value] of Object.entries(row)) {
    if (!value) continue;
    const normalizedKey = normalizeHeaderKey(key.replace(/__\d+$/, ""));
    if (normalizedAliases.includes(normalizedKey)) return value;
  }
  return "";
};

const mapNotionStatus = (value) => {
  const raw = (value || "").toLowerCase();
  if (/(outoftown|out of town|travel|travelling|traveling|vacation)/.test(raw)) return "out-of-town";
  if (/(programdone|done|complete|completed|closed)/.test(raw)) return "completed";
  if (/(onhold|hold|paused|pause)/.test(raw)) return "on-hold";
  if (/(inactive|drop|dropped|lost)/.test(raw)) return "inactive";
  if (/(active|ongoing|running|inprogress)/.test(raw)) return "active";
  return "active";
};

const getClientStatusMeta = (status) => CLIENT_STATUS_META[status] || CLIENT_STATUS_META.active;

export function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [weightSummaries, setWeightSummaries] = useState({});
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
      const [clientRes, weightSummaryRes] = await Promise.all([
        api.get("/clients"),
        api.get("/clients/weight-summaries", { params: { entries: 10 } }),
      ]);
      setClients(clientRes.data);
      const drafts = {};
      clientRes.data.forEach((client) => {
        drafts[client.id] = {
          recent_comment: "",
          diet_start_date: client.diet_start_date || "",
          diet_end_date: client.diet_end_date || "",
          last_follow_up_date: client.last_follow_up_date || "",
          upcoming_follow_up_date: client.upcoming_follow_up_date || ""
        };
      });
      setRowDrafts(drafts);
      setWeightSummaries(Object.fromEntries((weightSummaryRes.data || []).map((summary) => [summary.client_id, summary])));
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
    setFormData(clientPayloadToFormData(client));
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

      const payload = rows.map(mapCsvRowToClientPayload).find((item) => item.name);
      if (!payload) {
        toast.error("No valid client row found in CSV");
        return;
      }

      setEditingClient(null);
      setFormData(clientPayloadToFormData(payload));
      setDialogOpen(true);
      toast.success(rows.length > 1 ? "First client row imported into the form" : "Client profile imported into the form");
    } catch (err) {
      toast.error("Failed to parse CSV");
    } finally {
      setCsvImporting(false);
    }
  };

  const submitInlineComment = async (clientId) => {
    const comment = (rowDrafts[clientId]?.recent_comment || "").trim();
    if (!comment) return;
    try {
      await api.post(`/clients/${clientId}/comments`, { content: comment });
      setClients((prev) => prev.map((client) => (
        client.id === clientId
          ? { ...client, recent_comment: comment }
          : client
      )));
      setRowDrafts((prev) => ({
        ...prev,
        [clientId]: {
          ...prev[clientId],
          recent_comment: "",
        },
      }));
      toast.success("Comment saved");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save comment");
    }
  };

  const activeCount = clients.filter((client) => client.status === "active" || client.status === "out-of-town").length;
  const totalCount = clients.length;

  const visibleClients = clients
    .filter((client) => {
      if (clientScope === "active" && client.status !== "active" && client.status !== "out-of-town") return false;
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
          <Button variant="outline" onClick={triggerCsvPicker} disabled={csvImporting}>
            <Upload className="w-4 h-4 mr-2" />
            {csvImporting ? "Importing CSV..." : "Import Client CSV"}
          </Button>
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

      <TooltipProvider delayDuration={120}>
        <Card className="border-border/40 bg-card/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] table-fixed">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="table-dense text-left w-[220px]">Client</th>
                  <th className="table-dense text-left w-[160px]">10-Day Diff</th>
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
                    const statusMeta = getClientStatusMeta(client.status);
                    const weightSummary = weightSummaries[client.id];
                    const weightDelta = weightSummary?.delta_kg;
                    const hasWeightTrend = typeof weightDelta === "number";
                    const formattedWeightDelta = hasWeightTrend
                      ? `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} kg`
                      : "—";
                    return (
                      <tr key={client.id} className="table-dense align-top" data-testid={`client-row-${client.id}`}>
                        <td>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className={`h-3.5 w-3.5 rounded-full transition-transform hover:scale-110 ${statusMeta.dotClassName}`}
                                  aria-label={statusMeta.label}
                                />
                              </TooltipTrigger>
                              <TooltipContent>{statusMeta.label}</TooltipContent>
                            </Tooltip>
                            <Link to={`/clients/${client.id}`} className="font-semibold text-primary hover:underline">
                              {client.name}
                            </Link>
                          </div>
                        </td>
                        <td>
                          {weightSummary?.entries?.length ? (
                            <HoverCard openDelay={120} closeDelay={100}>
                              <HoverCardTrigger asChild>
                                <button
                                  type="button"
                                  className={`text-sm font-semibold ${
                                    weightDelta < 0 ? "text-green-500" : weightDelta > 0 ? "text-red-400" : "text-muted-foreground"
                                  }`}
                                >
                                  {formattedWeightDelta}
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent align="start" className="w-72">
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-sm font-semibold">Last 10 Weight Logs</p>
                                    <p className="text-xs text-muted-foreground">Newest entry shown first.</p>
                                  </div>
                                  <div className="rounded-lg border border-border/50 overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-muted/40">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-medium">Date</th>
                                          <th className="px-3 py-2 text-right font-medium">Weight</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {weightSummary.entries.map((entry) => (
                                          <tr key={`${client.id}-${entry.recorded_date}`} className="border-t border-border/40">
                                            <td className="px-3 py-2">{entry.recorded_date}</td>
                                            <td className="px-3 py-2 text-right">{entry.weight_kg} kg</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td>
                          <Input
                            value={draft.recent_comment ?? ""}
                            onChange={(e) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], recent_comment: e.target.value } }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                submitInlineComment(client.id);
                              }
                            }}
                            placeholder={client.recent_comment ? `Latest: ${client.recent_comment}` : "Add comment and press Enter"}
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
      </TooltipProvider>

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
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={triggerCsvPicker} disabled={csvImporting}>
                    <Upload className="w-4 h-4 mr-2" />
                    {csvImporting ? "Importing..." : "Upload Client Profile CSV"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload a client profile CSV to prefill this form before saving the client.
                </p>
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
                    {CLIENT_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
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
