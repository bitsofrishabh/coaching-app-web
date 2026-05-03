import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus, Search, Edit, Trash2, Upload, Sparkles,
  ArrowUp, ArrowDown, ArrowUpDown, TrendingDown, TrendingUp,
  Minus, Calendar, MessageSquare, ChevronDown, Users, Clock,
  AlertTriangle, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";

const CLIENT_FORM_DEFAULTS = {
  name: "", age: "", gender: "", height_cm: "", diet_preference: "",
  email: "", phone: "", location: "", profession: "", about_client: "",
  health_issues: "", diet_start_date: "", diet_duration: "", diet_end_date: "",
  program_start_date: "", program_duration: "", pause_days: "", program_end_date: "",
  initial_weight_kg: "", current_weight_kg: "", goal_weight_kg: "",
  status: "active", primary_coach: "", sleep_quality: "", sleep_hours: "",
  morning_freshness: "", notes: "", recent_comment: "",
  last_follow_up_date: "", upcoming_follow_up_date: ""
};

const DURATION_OPTIONS = ["2 Weeks", "4 Weeks", "6 Weeks", "8 Weeks", "12 Weeks", "16 Weeks"];
const DIET_PREFERENCE_OPTIONS = ["Vegetarian", "Non Vegetarian", "Eggetarian", "Vegan", "Jain"];
const CLIENT_SORT_OPTIONS = [
  { value: "client-asc", label: "Client (A–Z)" },
  { value: "client-desc", label: "Client (Z–A)" },
  { value: "created-at-desc", label: "Newest Added" },
  { value: "last-follow-up-desc", label: "Last Follow-up" }
];
const CLIENT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on-hold", label: "Paused" },
  { value: "inactive", label: "Stopped" },
  { value: "completed", label: "Program Done" },
  { value: "out-of-town", label: "Out of Town" }
];

const CLIENT_STATUS_META = {
  active: { label: "Active", dot: "bg-emerald-400", badge: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" },
  "on-hold": { label: "Paused", dot: "bg-amber-400", badge: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
  inactive: { label: "Stopped", dot: "bg-red-400", badge: "bg-red-400/10 text-red-400 border-red-400/20" },
  completed: { label: "Done", dot: "bg-primary", badge: "bg-primary/10 text-primary border-primary/20" },
  "out-of-town": { label: "Out of Town", dot: "bg-orange-400", badge: "bg-orange-400/10 text-orange-400 border-orange-400/20" }
};

const AVATAR_COLORS = [
  "bg-violet-500/20 text-violet-400",
  "bg-sky-500/20 text-sky-400",
  "bg-pink-500/20 text-pink-400",
  "bg-amber-500/20 text-amber-400",
  "bg-teal-500/20 text-teal-400",
  "bg-primary/20 text-primary",
];

const getAvatarColor = (name = "") => {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

const getInitials = (name = "") =>
  name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

const textOrNull = (value) => { const t = (value ?? "").toString().trim(); return t || null; };
const parseNullableInt = (value) => { const p = parseInt((value ?? "").toString().trim(), 10); return Number.isNaN(p) ? null : p; };
const parseNullableFloat = (value) => { const p = parseFloat((value ?? "").toString().replace(/[^\d.-]/g, "")); return Number.isNaN(p) ? null : p; };
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
    if (!Number.isNaN(feet) && !Number.isNaN(inch) && inch < 12)
      return +(feet * 30.48 + inch * 2.54).toFixed(1);
  }
  const ftInMatch = raw.match(/(\d+)[^\d]+(\d+)/);
  if (ftInMatch) {
    const feet = parseInt(ftInMatch[1], 10);
    const inch = parseInt(ftInMatch[2], 10);
    if (!Number.isNaN(feet) && !Number.isNaN(inch))
      return +(feet * 30.48 + inch * 2.54).toFixed(1);
  }
  return parseNullableFloat(raw);
};

const formatDate = (isoDate) => {
  if (!isoDate) return null;
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
};

const getDaysFromNow = (isoDate) => {
  if (!isoDate) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
};

const getDietProgress = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const total = end - start;
  const elapsed = today - start;
  if (total <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
};

const buildClientPayload = (source) => ({
  name: (source.name || "").trim(),
  email: textOrNull(source.email), phone: textOrNull(source.phone),
  location: textOrNull(source.location), profession: textOrNull(source.profession),
  age: parseNullableInt(source.age), gender: textOrNull(source.gender),
  diet_preference: textOrNull(source.diet_preference), primary_coach: textOrNull(source.primary_coach),
  height_cm: parseNullableFloat(source.height_cm),
  initial_weight_kg: parseNullableFloat(source.initial_weight_kg),
  current_weight_kg: parseNullableFloat(source.current_weight_kg),
  goal_weight_kg: parseNullableFloat(source.goal_weight_kg),
  status: textOrNull(source.status) || "active",
  about_client: textOrNull(source.about_client), health_issues: textOrNull(source.health_issues),
  recent_comment: textOrNull(source.recent_comment),
  diet_start_date: normalizeToIsoDate(source.diet_start_date),
  diet_duration: textOrNull(source.diet_duration), diet_end_date: normalizeToIsoDate(source.diet_end_date),
  program_start_date: normalizeToIsoDate(source.program_start_date),
  program_duration: textOrNull(source.program_duration), pause_days: parseNullableInt(source.pause_days),
  program_end_date: normalizeToIsoDate(source.program_end_date),
  sleep_quality: textOrNull(source.sleep_quality), sleep_hours: textOrNull(source.sleep_hours),
  morning_freshness: textOrNull(source.morning_freshness), notes: textOrNull(source.notes)
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
  const rows = []; let row = []; let value = ""; let inQuotes = false;
  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i]; const next = csvText[i + 1];
    if (char === "\"") { if (inQuotes && next === "\"") { value += "\""; i += 1; } else { inQuotes = !inQuotes; } continue; }
    if (char === "," && !inQuotes) { row.push(value); value = ""; continue; }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value); rows.push(row); row = []; value = ""; continue;
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
  return rows.slice(1).filter((r) => r.some((cell) => cell?.trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])));
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
const pickDietFromCsv = (row) => {
  const keys = Object.keys(row).filter((key) => key === "Are you?" || key.startsWith("Are you?__") || normalizeHeaderKey(key) === "dietpreference");
  const values = keys.map((key) => row[key]).filter(Boolean);
  const vegValue = values.find((item) => /veg|vegetarian|jain|vegan|egg/i.test(item));
  return vegValue || values[0] || "";
};
const mapNotionStatus = (value) => {
  const raw = (value || "").toLowerCase();
  if (/(outoftown|out of town|travel|travelling|traveling|vacation)/.test(raw)) return "out-of-town";
  if (/(programdone|done|complete|completed|closed)/.test(raw)) return "completed";
  if (/(onhold|hold|paused|pause)/.test(raw)) return "on-hold";
  if (/(inactive|drop|dropped|lost)/.test(raw)) return "inactive";
  return "active";
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
  ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join(", ");

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
      fatherHistory ? `Father History: ${fatherHistory}` : "",
      motherHistory ? `Mother History: ${motherHistory}` : "",
      physicalActivity ? `Physical Activity: ${physicalActivity}` : "",
      activityMinutes ? `General Activity: ${activityMinutes}` : "",
      workStress ? `Work Stress: ${workStress}` : "",
      waterIntake ? `Water Intake: ${waterIntake}` : "",
      hairCondition ? `Hair Condition: ${hairCondition}` : "",
      mealTimes ? `Meal Times: ${mealTimes}` : "",
    ].filter(Boolean).join(" | ")
  });
};

const getClientStatusMeta = (status) => CLIENT_STATUS_META[status] || CLIENT_STATUS_META.active;

const getSortState = (sortValue) => {
  if ((sortValue || "").endsWith("-asc")) return { key: sortValue.slice(0, -4), direction: "asc" };
  if ((sortValue || "").endsWith("-desc")) return { key: sortValue.slice(0, -5), direction: "desc" };
  return { key: "client", direction: "asc" };
};

const compareNullableValues = (leftValue, rightValue, direction, type = "text") => {
  const leftMissing = leftValue === null || leftValue === undefined || leftValue === "";
  const rightMissing = rightValue === null || rightValue === undefined || rightValue === "";
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  let result = 0;
  if (type === "number") result = Number(leftValue) - Number(rightValue);
  else result = String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: "base" });
  return direction === "asc" ? result : -result;
};

function SortableHeader({ label, columnKey, activeSort, onSort }) {
  const active = activeSort.key === columnKey;
  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      className={`inline-flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
      {active
        ? activeSort.direction === "asc"
          ? <ArrowUp className="h-3 w-3" />
          : <ArrowDown className="h-3 w-3" />
        : <ArrowUpDown className="h-3 w-3 opacity-40" />}
    </button>
  );
}

function DateCell({ value, draft, clientId, field, onDraftChange, onSave }) {
  const [editing, setEditing] = useState(false);
  const days = getDaysFromNow(value);
  const isOverdue = days !== null && days < 0;
  const isSoon = days !== null && days >= 0 && days <= 7;

  if (editing) {
    return (
      <Input
        type="date"
        autoFocus
        value={draft ?? ""}
        onChange={(e) => onDraftChange(e.target.value)}
        onBlur={(e) => { onSave(clientId, field, e.target.value); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); if (e.key === "Enter") { onSave(clientId, field, draft); setEditing(false); } }}
        className="h-7 text-xs px-2 w-full"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      data-testid={`date-cell-${field}-${clientId}`}
      className="group flex items-center gap-1.5 text-left w-full rounded px-1.5 py-1 hover:bg-muted/40 transition-colors"
    >
      {value ? (
        <span className={`text-xs font-medium ${isOverdue ? "text-red-400" : isSoon ? "text-amber-400" : "text-foreground"}`}>
          {formatDate(value)}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">Set date</span>
      )}
      {isOverdue && <span className="text-[10px] text-red-400 font-semibold">({Math.abs(days)}d ago)</span>}
      {isSoon && !isOverdue && <span className="text-[10px] text-amber-400 font-semibold">(in {days}d)</span>}
    </button>
  );
}

export function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [weightSummaries, setWeightSummaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clientScope, setClientScope] = useState("active");
  const [sortBy, setSortBy] = useState("client-asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [formData, setFormData] = useState(CLIENT_FORM_DEFAULTS);
  const [rowDrafts, setRowDrafts] = useState({});
  const [editingCommentClientId, setEditingCommentClientId] = useState(null);
  const csvInputRef = useRef(null);
  const commentInputRefs = useRef({});

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
      setWeightSummaries(Object.fromEntries((weightSummaryRes.data || []).map((s) => [s.client_id, s])));
    } catch {
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  useEffect(() => {
    if (!editingCommentClientId) return;
    const input = commentInputRefs.current[editingCommentClientId];
    if (input) input.focus();
  }, [editingCommentClientId]);

  const resetForm = () => setFormData(CLIENT_FORM_DEFAULTS);
  const openCreateDialog = () => { resetForm(); setEditingClient(null); setDialogOpen(true); };
  const openEditDialog = (client) => { setEditingClient(client); setFormData(clientPayloadToFormData(client)); setDialogOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = buildClientPayload(formData);
      if (!payload.name) { toast.error("Client name is required"); return; }
      if (editingClient) {
        await api.put(`/clients/${editingClient.id}`, payload);
        toast.success("Client updated successfully");
      } else {
        await api.post("/clients", payload);
        toast.success("Client added successfully");
      }
      setDialogOpen(false); setEditingClient(null); resetForm(); fetchClients();
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
    } catch { toast.error("Failed to delete client"); }
  };

  const saveInlineField = async (clientId, field, rawValue) => {
    try {
      const value = field.includes("date") ? normalizeToIsoDate(rawValue) : textOrNull(rawValue);
      await api.put(`/clients/${clientId}`, { [field]: value });
      setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, [field]: value } : c));
    } catch { toast.error("Failed to update client"); }
  };

  const triggerCsvPicker = () => { if (csvImporting) return; csvInputRef.current?.click(); };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setCsvImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsvRows(text);
      if (!rows.length) { toast.error("CSV looks empty"); return; }
      const payload = rows.map(mapCsvRowToClientPayload).find((item) => item.name);
      if (!payload) { toast.error("No valid client row found in CSV"); return; }
      setEditingClient(null); setFormData(clientPayloadToFormData(payload)); setDialogOpen(true);
      toast.success(rows.length > 1 ? "First client row imported into the form" : "Client profile imported into the form");
    } catch { toast.error("Failed to parse CSV");
    } finally { setCsvImporting(false); }
  };

  const submitInlineComment = async (clientId) => {
    const comment = (rowDrafts[clientId]?.recent_comment || "").trim();
    if (!comment) return;
    try {
      await api.post(`/clients/${clientId}/comments`, { content: comment });
      setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, recent_comment: comment } : c));
      setRowDrafts((prev) => ({ ...prev, [clientId]: { ...prev[clientId], recent_comment: "" } }));
      setEditingCommentClientId((prev) => (prev === clientId ? null : prev));
      toast.success("Comment saved");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to save comment"); }
  };

  const startInlineCommentEdit = (clientId) => {
    setRowDrafts((prev) => ({ ...prev, [clientId]: { ...prev[clientId], recent_comment: "" } }));
    setEditingCommentClientId(clientId);
  };

  const cancelInlineCommentEdit = (clientId) => {
    setRowDrafts((prev) => ({ ...prev, [clientId]: { ...prev[clientId], recent_comment: "" } }));
    setEditingCommentClientId((prev) => (prev === clientId ? null : prev));
  };

  const activeSort = getSortState(sortBy);
  const toggleColumnSort = (columnKey) => {
    setSortBy((cur) => {
      const s = getSortState(cur);
      if (s.key === columnKey) return `${columnKey}-${s.direction === "asc" ? "desc" : "asc"}`;
      return `${columnKey}-asc`;
    });
  };

  const activeCount = clients.filter((c) => c.status === "active" || c.status === "out-of-town").length;
  const totalCount = clients.length;
  const pausedCount = clients.filter((c) => c.status === "on-hold").length;
  const overdueFollowUpCount = clients.filter((c) => {
    const d = getDaysFromNow(c.upcoming_follow_up_date);
    return d !== null && d < 0;
  }).length;
  const expiringSoonCount = clients.filter((c) => {
    const d = getDaysFromNow(c.diet_end_date);
    return d !== null && d >= 0 && d <= 7;
  }).length;

  const visibleClients = clients
    .filter((c) => {
      if (clientScope === "active" && c.status !== "active" && c.status !== "out-of-town") return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [c.name, c.email, c.phone].some((f) => (f || "").toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const wA = weightSummaries[a.id]?.delta_kg;
      const wB = weightSummaries[b.id]?.delta_kg;
      switch (activeSort.key) {
        case "client": return compareNullableValues(a.name, b.name, activeSort.direction);
        case "weight-diff": return compareNullableValues(wA, wB, activeSort.direction, "number");
        case "recent-comment": return compareNullableValues(a.recent_comment, b.recent_comment, activeSort.direction);
        case "diet-start": return compareNullableValues(a.diet_start_date, b.diet_start_date, activeSort.direction);
        case "diet-expire": return compareNullableValues(a.diet_end_date, b.diet_end_date, activeSort.direction);
        case "last-follow-up": return compareNullableValues(a.last_follow_up_date, b.last_follow_up_date, activeSort.direction);
        case "upcoming-follow-up": return compareNullableValues(a.upcoming_follow_up_date, b.upcoming_follow_up_date, activeSort.direction);
        case "created-at": return compareNullableValues(a.created_at, b.created_at, activeSort.direction);
        default: return compareNullableValues(a.name, b.name, "asc");
      }
    });

  return (
    <div className="space-y-5 animate-fade-in" data-testid="clients-page">
      <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope'] tracking-tight">Client Tracker</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Stay on top of every client touchpoint and upcoming follow-up.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={triggerCsvPicker} disabled={csvImporting} data-testid="import-csv-btn">
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            {csvImporting ? "Importing..." : "Import CSV"}
          </Button>
          <Button variant="outline" size="sm">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Ask AI
          </Button>
          <Button size="sm" onClick={openCreateDialog} data-testid="add-client-btn" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_12px_rgba(132,204,22,0.25)]">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Client
          </Button>
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3.5 py-2">
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-sm font-semibold text-foreground">{activeCount}</span>
          <span className="text-xs text-muted-foreground">Active</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3.5 py-2">
          <Minus className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-sm font-semibold text-foreground">{pausedCount}</span>
          <span className="text-xs text-muted-foreground">Paused</span>
        </div>
        {overdueFollowUpCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/5 px-3.5 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-sm font-semibold text-red-400">{overdueFollowUpCount}</span>
            <span className="text-xs text-red-400/70">Overdue Follow-up</span>
          </div>
        )}
        {expiringSoonCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3.5 py-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">{expiringSoonCount}</span>
            <span className="text-xs text-amber-400/70">Expiring in 7d</span>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3.5 py-2 ml-auto">
          <span className="text-xs text-muted-foreground">{totalCount} total</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col xl:flex-row gap-2.5 items-start xl:items-center">
        <div className="flex rounded-lg border border-border/50 bg-muted/20 p-0.5 shrink-0">
          {[
            { value: "active", label: `Active (${activeCount})` },
            { value: "all", label: `All (${totalCount})` }
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setClientScope(tab.value)}
              data-testid={`scope-${tab.value}`}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${clientScope === tab.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 w-full xl:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="client-search"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full xl:w-48 h-9 text-sm" data-testid="sort-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLIENT_SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <TooltipProvider delayDuration={120}>
        <div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="px-4 py-3 text-left w-[200px]">
                    <SortableHeader label="Client" columnKey="client" activeSort={activeSort} onSort={toggleColumnSort} />
                  </th>
                  <th className="px-4 py-3 text-left w-[120px]">
                    <SortableHeader label="10-Day Δ" columnKey="weight-diff" activeSort={activeSort} onSort={toggleColumnSort} />
                  </th>
                  <th className="px-4 py-3 text-left w-[240px]">
                    <SortableHeader label="Recent Comment" columnKey="recent-comment" activeSort={activeSort} onSort={toggleColumnSort} />
                  </th>
                  <th className="px-4 py-3 text-left w-[200px]">
                    <SortableHeader label="Diet Period" columnKey="diet-start" activeSort={activeSort} onSort={toggleColumnSort} />
                  </th>
                  <th className="px-4 py-3 text-left w-[160px]">
                    <SortableHeader label="Last Follow-up" columnKey="last-follow-up" activeSort={activeSort} onSort={toggleColumnSort} />
                  </th>
                  <th className="px-4 py-3 text-left w-[160px]">
                    <SortableHeader label="Next Follow-up" columnKey="upcoming-follow-up" activeSort={activeSort} onSort={toggleColumnSort} />
                  </th>
                  <th className="px-4 py-3 text-right w-[80px]">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 bg-muted/30 rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : visibleClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-muted-foreground text-sm">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      No clients found for this filter.
                    </td>
                  </tr>
                ) : (
                  visibleClients.map((client) => {
                    const draft = rowDrafts[client.id] || {};
                    const statusMeta = getClientStatusMeta(client.status);
                    const weightSummary = weightSummaries[client.id];
                    const weightDelta = weightSummary?.delta_kg;
                    const hasWeightTrend = typeof weightDelta === "number";
                    const dietProgress = getDietProgress(client.diet_start_date, client.diet_end_date);
                    const daysUntilExpiry = getDaysFromNow(client.diet_end_date);
                    const initials = getInitials(client.name);
                    const avatarColor = getAvatarColor(client.name);

                    return (
                      <tr
                        key={client.id}
                        className="group hover:bg-muted/20 transition-colors"
                        data-testid={`client-row-${client.id}`}
                      >
                        {/* Client */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor}`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={`/clients/${client.id}`}
                                className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block leading-tight"
                              >
                                {client.name}
                              </Link>
                              <span className={`inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${statusMeta.badge}`}>
                                <span className={`w-1 h-1 rounded-full ${statusMeta.dot}`} />
                                {statusMeta.label}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Weight delta */}
                        <td className="px-4 py-3">
                          {hasWeightTrend && weightSummary?.entries?.length ? (
                            <HoverCard openDelay={120} closeDelay={100}>
                              <HoverCardTrigger asChild>
                                <button
                                  type="button"
                                  className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md border cursor-default ${
                                    weightDelta < 0
                                      ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                                      : weightDelta > 0
                                      ? "bg-red-400/10 text-red-400 border-red-400/20"
                                      : "bg-muted/30 text-muted-foreground border-border/40"
                                  }`}
                                >
                                  {weightDelta < 0 ? <TrendingDown className="w-3 h-3" /> : weightDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                  {weightDelta > 0 ? "+" : ""}{weightDelta.toFixed(1)} kg
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent align="start" className="w-64 p-3">
                                <p className="text-xs font-semibold mb-2 text-foreground">Last 10 Weight Logs</p>
                                <div className="rounded-lg border border-border/50 overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted/40">
                                      <tr>
                                        <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Date</th>
                                        <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Weight</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {weightSummary.entries.map((entry) => (
                                        <tr key={`${client.id}-${entry.recorded_date}`} className="border-t border-border/40">
                                          <td className="px-3 py-1.5 text-muted-foreground">{entry.recorded_date}</td>
                                          <td className="px-3 py-1.5 text-right font-medium">{entry.weight_kg} kg</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>

                        {/* Recent Comment */}
                        <td className="px-4 py-3">
                          {editingCommentClientId === client.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                ref={(node) => {
                                  if (node) commentInputRefs.current[client.id] = node;
                                  else delete commentInputRefs.current[client.id];
                                }}
                                value={draft.recent_comment ?? ""}
                                onChange={(e) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], recent_comment: e.target.value } }))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); submitInlineComment(client.id); }
                                  if (e.key === "Escape") { e.preventDefault(); cancelInlineCommentEdit(client.id); }
                                }}
                                onBlur={() => cancelInlineCommentEdit(client.id)}
                                placeholder="Add comment…"
                                className="h-7 text-xs"
                              />
                            </div>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onDoubleClick={() => startInlineCommentEdit(client.id)}
                                  className="flex items-start gap-1.5 text-left w-full group/comment"
                                  data-testid={`comment-cell-${client.id}`}
                                >
                                  <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground/40 group-hover/comment:text-primary/60 transition-colors" />
                                  <span className={`text-xs leading-snug line-clamp-2 ${client.recent_comment ? "text-muted-foreground" : "text-muted-foreground/30 italic"}`}>
                                    {client.recent_comment || "Double-click to add…"}
                                  </span>
                                </button>
                              </TooltipTrigger>
                              {client.recent_comment && (
                                <TooltipContent className="max-w-xs text-xs">{client.recent_comment}</TooltipContent>
                              )}
                            </Tooltip>
                          )}
                        </td>

                        {/* Diet Period */}
                        <td className="px-4 py-3">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <DateCell
                                value={client.diet_start_date}
                                draft={draft.diet_start_date}
                                clientId={client.id}
                                field="diet_start_date"
                                onDraftChange={(v) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], diet_start_date: v } }))}
                                onSave={saveInlineField}
                              />
                              <span className="text-muted-foreground/30">→</span>
                              <DateCell
                                value={client.diet_end_date}
                                draft={draft.diet_end_date}
                                clientId={client.id}
                                field="diet_end_date"
                                onDraftChange={(v) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], diet_end_date: v } }))}
                                onSave={saveInlineField}
                              />
                            </div>
                            {dietProgress !== null && (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      dietProgress >= 90 ? "bg-red-400" :
                                      dietProgress >= 70 ? "bg-amber-400" :
                                      "bg-primary"
                                    }`}
                                    style={{ width: `${dietProgress}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground/60 shrink-0">{dietProgress}%</span>
                              </div>
                            )}
                            {daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7 && (
                              <span className="text-[10px] text-amber-400 font-semibold">Expires in {daysUntilExpiry}d</span>
                            )}
                            {daysUntilExpiry !== null && daysUntilExpiry < 0 && (
                              <span className="text-[10px] text-red-400 font-semibold">Expired {Math.abs(daysUntilExpiry)}d ago</span>
                            )}
                          </div>
                        </td>

                        {/* Last Follow-up */}
                        <td className="px-4 py-3">
                          <DateCell
                            value={client.last_follow_up_date}
                            draft={draft.last_follow_up_date}
                            clientId={client.id}
                            field="last_follow_up_date"
                            onDraftChange={(v) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], last_follow_up_date: v } }))}
                            onSave={saveInlineField}
                          />
                        </td>

                        {/* Upcoming Follow-up */}
                        <td className="px-4 py-3">
                          <DateCell
                            value={client.upcoming_follow_up_date}
                            draft={draft.upcoming_follow_up_date}
                            clientId={client.id}
                            field="upcoming_follow_up_date"
                            onDraftChange={(v) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], upcoming_follow_up_date: v } }))}
                            onSave={saveInlineField}
                          />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEditDialog(client)}
                                  data-testid={`edit-client-${client.id}`}
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit client</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive/60 hover:text-destructive"
                                  onClick={() => handleDelete(client.id)}
                                  data-testid={`delete-client-${client.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete client</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!loading && visibleClients.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border/30 bg-muted/10 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{visibleClients.length}</span> of <span className="font-medium text-foreground">{clients.length}</span> clients
              </span>
              <span className="text-xs text-muted-foreground">Click date cells to edit · Double-click comment to update</span>
            </div>
          )}
        </div>
      </TooltipProvider>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-['Manrope']">
              {editingClient ? "Edit Client" : "Add New Client"}
            </DialogTitle>
            <DialogDescription>
              {editingClient ? "Update detailed client profile information" : "Add manually or import from CSV sample"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-2">
            {!editingClient && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Import from CSV</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={triggerCsvPicker} disabled={csvImporting}>
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {csvImporting ? "Importing..." : "Upload CSV"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Upload a client profile CSV to prefill this form.</p>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1.5">Basic Info</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Full Name *</Label>
                  <Input data-testid="client-name-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter full name" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Age</Label>
                  <Input type="number" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} placeholder="Enter age" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <div className="flex items-center gap-4 h-9 px-3 rounded-md border border-border/50 bg-background">
                    {["male", "female", "other"].map((g) => (
                      <label key={g} className="flex items-center gap-1.5 text-sm capitalize cursor-pointer">
                        <input type="radio" name="gender" checked={formData.gender === g} onChange={() => setFormData({ ...formData, gender: g })} />
                        {g}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Height (cm)</Label>
                  <Input value={formData.height_cm} onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })} placeholder="e.g. 165" />
                </div>
                <div className="space-y-1.5">
                  <Label>Diet Preference</Label>
                  <Select value={formData.diet_preference || "none"} onValueChange={(v) => setFormData({ ...formData, diet_preference: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select diet" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {DIET_PREFERENCE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+91 xxxxx xxxxx" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1.5">Health Profile</p>
              <div className="space-y-1.5">
                <Label>About Client</Label>
                <Textarea value={formData.about_client} onChange={(e) => setFormData({ ...formData, about_client: e.target.value })} placeholder="Brief description about the client's lifestyle" rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Health Issues</Label>
                <Input value={formData.health_issues} onChange={(e) => setFormData({ ...formData, health_issues: e.target.value })} placeholder="e.g. Diabetes, PCOD, Thyroid" />
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1.5">Diet Plan</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Diet Start Date</Label>
                  <Input type="date" value={formData.diet_start_date} onChange={(e) => setFormData({ ...formData, diet_start_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Diet Duration</Label>
                  <Select value={formData.diet_duration || "none"} onValueChange={(v) => setFormData({ ...formData, diet_duration: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {DURATION_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Diet End Date</Label>
                  <Input type="date" value={formData.diet_end_date} onChange={(e) => setFormData({ ...formData, diet_end_date: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1.5">Program</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label>Program Start</Label>
                  <Input type="date" value={formData.program_start_date} onChange={(e) => setFormData({ ...formData, program_start_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Program Duration</Label>
                  <Select value={formData.program_duration || "none"} onValueChange={(v) => setFormData({ ...formData, program_duration: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {DURATION_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Pause Days</Label>
                  <Input type="number" value={formData.pause_days} onChange={(e) => setFormData({ ...formData, pause_days: e.target.value })} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Program End</Label>
                  <Input type="date" value={formData.program_end_date} onChange={(e) => setFormData({ ...formData, program_end_date: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1.5">Weight & Goals</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Start Weight (kg)</Label>
                  <Input type="number" step="0.1" value={formData.initial_weight_kg} onChange={(e) => setFormData({ ...formData, initial_weight_kg: e.target.value })} placeholder="e.g. 75.0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Target Weight (kg)</Label>
                  <Input type="number" step="0.1" value={formData.goal_weight_kg} onChange={(e) => setFormData({ ...formData, goal_weight_kg: e.target.value })} placeholder="e.g. 65.0" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1.5">Assignment</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={formData.status || "active"} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLIENT_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Primary Coach</Label>
                  <Input value={formData.primary_coach} onChange={(e) => setFormData({ ...formData, primary_coach: e.target.value })} placeholder="Coach name" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="City" />
                </div>
                <div className="space-y-1.5">
                  <Label>Profession</Label>
                  <Input value={formData.profession} onChange={(e) => setFormData({ ...formData, profession: e.target.value })} placeholder="Profession" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes" rows={2} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                {editingClient ? "Update Client" : "Add Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
