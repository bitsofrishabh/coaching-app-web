import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, Upload, Sparkles, ArrowUp, ArrowDown, ArrowUpDown, CalendarDays } from "lucide-react";
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
  { value: "client-asc", label: "Client (A-Z)" },
  { value: "client-desc", label: "Client (Z-A)" },
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
  active: {
    label: "Active",
    dotClassName: "bg-violet-500 shadow-[0_0_0_4px_rgba(139,92,246,0.16)]"
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

const parseIsoDateToLocal = (value) => {
  const raw = (value ?? "").toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map((part) => parseInt(part, 10));
  if ([year, month, day].some((part) => Number.isNaN(part))) return null;
  return new Date(year, month - 1, day);
};

const getDateUrgencyMeta = (value) => {
  const targetDate = parseIsoDateToLocal(value);
  if (!targetDate) {
    return {
      className: "",
      title: ""
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  const diffInDays = Math.round((targetDate.getTime() - today.getTime()) / 86400000);

  if (diffInDays <= 3) {
    return {
      className: "border-red-500/60 bg-red-500/8 text-red-500 focus-visible:ring-red-500/30",
      title: diffInDays < 0 ? `${Math.abs(diffInDays)} day${Math.abs(diffInDays) === 1 ? "" : "s"} overdue` : `Due in ${diffInDays} day${diffInDays === 1 ? "" : "s"}`
    };
  }

  if (diffInDays <= 5) {
    return {
      className: "border-orange-400/60 bg-orange-400/8 text-orange-500 focus-visible:ring-orange-400/30",
      title: `Due in ${diffInDays} day${diffInDays === 1 ? "" : "s"}`
    };
  }

  return {
    className: "border-emerald-500/50 bg-emerald-500/8 text-emerald-600 focus-visible:ring-emerald-500/30",
    title: `Due in ${diffInDays} days`
  };
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
const TRACKER_HEADER_CLASS = "sticky top-0 z-10 bg-background/95 px-3 py-3 text-center text-[12px] font-medium text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/85";
const TRACKER_HEADER_BUTTON_CLASS = "mx-auto inline-flex items-center justify-center gap-2 rounded-md px-2 py-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground";
const TRACKER_CELL_INPUT_CLASS = "h-9 rounded-md border-transparent bg-transparent px-2.5 text-[13px] shadow-none transition-colors hover:bg-muted/40 focus-visible:border-border/60 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/20";
const TRACKER_COMMENT_BUTTON_CLASS = "flex h-9 w-full items-center rounded-md border border-transparent bg-transparent px-2.5 text-left text-[13px] transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/20";

const getSortState = (sortValue) => {
  if ((sortValue || "").endsWith("-asc")) {
    return { key: sortValue.slice(0, -4), direction: "asc" };
  }
  if ((sortValue || "").endsWith("-desc")) {
    return { key: sortValue.slice(0, -5), direction: "desc" };
  }
  return { key: "client", direction: "asc" };
};

const compareNullableValues = (leftValue, rightValue, direction, type = "text") => {
  const leftMissing = leftValue === null || leftValue === undefined || leftValue === "";
  const rightMissing = rightValue === null || rightValue === undefined || rightValue === "";
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;

  let result = 0;
  if (type === "number") {
    result = Number(leftValue) - Number(rightValue);
  } else {
    result = String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: "base" });
  }

  return direction === "asc" ? result : -result;
};

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

  useEffect(() => {
    if (!editingCommentClientId) return;
    const input = commentInputRefs.current[editingCommentClientId];
    if (input) input.focus();
  }, [editingCommentClientId]);

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
      setEditingCommentClientId((prev) => (prev === clientId ? null : prev));
      toast.success("Comment saved");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save comment");
    }
  };

  const startInlineCommentEdit = (clientId) => {
    setRowDrafts((prev) => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        recent_comment: "",
      },
    }));
    setEditingCommentClientId(clientId);
  };

  const cancelInlineCommentEdit = (clientId) => {
    setRowDrafts((prev) => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        recent_comment: "",
      },
    }));
    setEditingCommentClientId((prev) => (prev === clientId ? null : prev));
  };

  const activeCount = clients.filter((client) => client.status === "active" || client.status === "out-of-town").length;
  const totalCount = clients.length;
  const activeSort = getSortState(sortBy);

  const toggleColumnSort = (columnKey) => {
    setSortBy((currentValue) => {
      const currentSort = getSortState(currentValue);
      if (currentSort.key === columnKey) {
        return `${columnKey}-${currentSort.direction === "asc" ? "desc" : "asc"}`;
      }
      return `${columnKey}-asc`;
    });
  };

  const getColumnSortIcon = (columnKey) => {
    if (activeSort.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground/70" />;
    }
    return activeSort.direction === "asc"
      ? <ArrowUp className="h-4 w-4 text-primary" />
      : <ArrowDown className="h-4 w-4 text-primary" />;
  };

  const visibleClients = clients
    .filter((client) => {
      if (clientScope === "active" && client.status !== "active" && client.status !== "out-of-town") return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [client.name, client.email, client.phone].some((field) => (field || "").toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const weightDeltaA = weightSummaries[a.id]?.delta_kg;
      const weightDeltaB = weightSummaries[b.id]?.delta_kg;

      switch (activeSort.key) {
        case "client":
          return compareNullableValues(a.name, b.name, activeSort.direction);
        case "weight-diff":
          return compareNullableValues(weightDeltaA, weightDeltaB, activeSort.direction, "number");
        case "recent-comment":
          return compareNullableValues(a.recent_comment, b.recent_comment, activeSort.direction);
        case "diet-start":
          return compareNullableValues(a.diet_start_date, b.diet_start_date, activeSort.direction);
        case "diet-expire":
          return compareNullableValues(a.diet_end_date, b.diet_end_date, activeSort.direction);
        case "last-follow-up":
          return compareNullableValues(a.last_follow_up_date, b.last_follow_up_date, activeSort.direction);
        case "upcoming-follow-up":
          return compareNullableValues(a.upcoming_follow_up_date, b.upcoming_follow_up_date, activeSort.direction);
        case "created-at":
          return compareNullableValues(a.created_at, b.created_at, activeSort.direction);
        default:
          return compareNullableValues(a.name, b.name, "asc");
      }
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
        <div className="flex rounded-xl border border-border/50 bg-background p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setClientScope("active")}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${clientScope === "active" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Active Clients ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setClientScope("all")}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${clientScope === "all" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
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
        <Card className="overflow-hidden rounded-2xl border border-border/50 bg-background shadow-[0_1px_0_rgba(15,23,42,0.02),0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="border-b border-border/50 bg-background px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Client database view
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] table-fixed">
              <thead>
                <tr className="border-b border-border/50">
                  <th className={`${TRACKER_HEADER_CLASS} w-[220px]`}>
                    <button type="button" className={TRACKER_HEADER_BUTTON_CLASS} onClick={() => toggleColumnSort("client")}>
                      <span>Client</span>
                      {getColumnSortIcon("client")}
                    </button>
                  </th>
                  <th className={`${TRACKER_HEADER_CLASS} w-[160px]`}>
                    <button type="button" className={TRACKER_HEADER_BUTTON_CLASS} onClick={() => toggleColumnSort("weight-diff")}>
                      <span>10-Day Diff</span>
                      {getColumnSortIcon("weight-diff")}
                    </button>
                  </th>
                  <th className={`${TRACKER_HEADER_CLASS} w-[240px]`}>
                    <button type="button" className={TRACKER_HEADER_BUTTON_CLASS} onClick={() => toggleColumnSort("recent-comment")}>
                      <span>Recent Comment</span>
                      {getColumnSortIcon("recent-comment")}
                    </button>
                  </th>
                  <th className={`${TRACKER_HEADER_CLASS} w-[170px]`}>
                    <button type="button" className={TRACKER_HEADER_BUTTON_CLASS} onClick={() => toggleColumnSort("diet-start")}>
                      <span>Diet Start</span>
                      {getColumnSortIcon("diet-start")}
                    </button>
                  </th>
                  <th className={`${TRACKER_HEADER_CLASS} w-[170px]`}>
                    <button type="button" className={TRACKER_HEADER_BUTTON_CLASS} onClick={() => toggleColumnSort("diet-expire")}>
                      <span>Diet Expire</span>
                      {getColumnSortIcon("diet-expire")}
                    </button>
                  </th>
                  <th className={`${TRACKER_HEADER_CLASS} w-[170px]`}>
                    <button type="button" className={TRACKER_HEADER_BUTTON_CLASS} onClick={() => toggleColumnSort("last-follow-up")}>
                      <span>Last Follow-up</span>
                      {getColumnSortIcon("last-follow-up")}
                    </button>
                  </th>
                  <th className={`${TRACKER_HEADER_CLASS} w-[180px]`}>
                    <button type="button" className={TRACKER_HEADER_BUTTON_CLASS} onClick={() => toggleColumnSort("upcoming-follow-up")}>
                      <span>Upcoming Follow-up</span>
                      {getColumnSortIcon("upcoming-follow-up")}
                    </button>
                  </th>
                  <th className={`${TRACKER_HEADER_CLASS} w-[110px]`}>Actions</th>
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
                    const dietExpiryUrgency = getDateUrgencyMeta(draft.diet_end_date ?? client.diet_end_date);
                    const upcomingFollowUpUrgency = getDateUrgencyMeta(draft.upcoming_follow_up_date ?? client.upcoming_follow_up_date);
                    const weightDelta = weightSummary?.delta_kg;
                    const hasWeightTrend = typeof weightDelta === "number";
                    const formattedWeightDelta = hasWeightTrend
                      ? `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} kg`
                      : "—";
                    return (
                      <tr key={client.id} className="table-dense align-top odd:bg-background even:bg-muted/[0.18]" data-testid={`client-row-${client.id}`}>
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
                            <Link to={`/clients/${client.id}`} className="font-medium text-foreground transition-colors hover:text-primary">
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
                                    weightDelta < 0 ? "text-violet-500" : weightDelta > 0 ? "text-red-400" : "text-muted-foreground"
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
                          {editingCommentClientId === client.id ? (
                            <Input
                              ref={(node) => {
                                if (node) {
                                  commentInputRefs.current[client.id] = node;
                                } else {
                                  delete commentInputRefs.current[client.id];
                                }
                              }}
                              value={draft.recent_comment ?? ""}
                              onChange={(e) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], recent_comment: e.target.value } }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  submitInlineComment(client.id);
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelInlineCommentEdit(client.id);
                                }
                              }}
                              onBlur={() => cancelInlineCommentEdit(client.id)}
                              placeholder="Add comment and press Enter"
                              className={TRACKER_CELL_INPUT_CLASS}
                            />
                          ) : (
                            <button
                              type="button"
                              onDoubleClick={() => startInlineCommentEdit(client.id)}
                              className={TRACKER_COMMENT_BUTTON_CLASS}
                              title={client.recent_comment || "Double-click to add comment"}
                            >
                              <span className={`truncate ${client.recent_comment ? "text-foreground" : "text-muted-foreground"}`}>
                                {client.recent_comment || "Double-click to add comment"}
                              </span>
                            </button>
                          )}
                        </td>
                        <td>
                          <Input
                            type="date"
                            value={draft.diet_start_date ?? ""}
                            onChange={(e) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], diet_start_date: e.target.value } }))}
                            onBlur={(e) => saveInlineField(client.id, "diet_start_date", e.target.value)}
                            className={TRACKER_CELL_INPUT_CLASS}
                          />
                        </td>
                        <td>
                          <Input
                            type="date"
                            title={dietExpiryUrgency.title}
                            value={draft.diet_end_date ?? ""}
                            onChange={(e) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], diet_end_date: e.target.value } }))}
                            onBlur={(e) => saveInlineField(client.id, "diet_end_date", e.target.value)}
                            className={`${TRACKER_CELL_INPUT_CLASS} ${dietExpiryUrgency.className}`}
                          />
                        </td>
                        <td>
                          <Input
                            type="date"
                            value={draft.last_follow_up_date ?? ""}
                            onChange={(e) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], last_follow_up_date: e.target.value } }))}
                            onBlur={(e) => saveInlineField(client.id, "last_follow_up_date", e.target.value)}
                            className={TRACKER_CELL_INPUT_CLASS}
                          />
                        </td>
                        <td>
                          <Input
                            type="date"
                            title={upcomingFollowUpUrgency.title}
                            value={draft.upcoming_follow_up_date ?? ""}
                            onChange={(e) => setRowDrafts((prev) => ({ ...prev, [client.id]: { ...prev[client.id], upcoming_follow_up_date: e.target.value } }))}
                            onBlur={(e) => saveInlineField(client.id, "upcoming_follow_up_date", e.target.value)}
                            className={`${TRACKER_CELL_INPUT_CLASS} ${upcomingFollowUpUrgency.className}`}
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(client)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-muted-foreground hover:text-destructive" onClick={() => handleDelete(client.id)}>
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
